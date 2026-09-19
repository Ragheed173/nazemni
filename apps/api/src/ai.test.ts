import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    semesterCourse: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    assessmentComponent: { count: vi.fn() },
    studyTask: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    lecture: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    assignment: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    project: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    projectMilestone: { create: vi.fn() },
    exam: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    grade: { findMany: vi.fn(), create: vi.fn() },
    weakTopic: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    review: { create: vi.fn() },
    semester: { findFirst: vi.fn() },
    appSettings: { findUnique: vi.fn() },
    aIConversation: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    aIMessage: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    aIUsage: { aggregate: vi.fn(), upsert: vi.fn() },
  },
  study: { getDailyPlan: vi.fn(), getBacklog: vi.fn(), getWeeklyReview: vi.fn() },
}));

vi.mock('./db.js', () => ({ prisma: mocks.prisma }));
vi.mock('./services/study.js', () => mocks.study);

import { AppError, errorHandler } from './errors.js';
import { MockAIProvider, OpenAIResponsesProvider } from './ai/provider.js';
import { assertDailyAILimit, boundAIHistory, defaultAIRuntimeConfig, estimateAIInputTokens, runAIConversation } from './ai/service.js';
import { compactBacklog, executeAITool, selectAIToolDefinitions } from './ai/tools.js';
import { createAIRouter } from './routes/ai.js';

const user = { id: 'user-a', name: 'A', email: 'a@example.com', emailVerified: true, image: null, username: 'a-user', displayUsername: 'A', role: 'USER', status: 'ACTIVE', preferredLanguage: 'en', lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() };
const course = { id: 'course-a', credits: 3, difficulty: 7, retake: false, targetGrade: 'B+', catalog: { courseCode: 'C1', nameAr: 'مادة', nameEn: 'Course' } };
const enabled = { ...defaultAIRuntimeConfig, enabled: true, requestsPerMinute: 1, requestsPerDay: 10, maxToolIterations: 2, inputTokenBudgetPerMinute: 1_000_000 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.semesterCourse.findFirst.mockResolvedValue(null);
  mocks.prisma.studyTask.findFirst.mockResolvedValue(null);
  mocks.prisma.lecture.findFirst.mockResolvedValue(null);
  mocks.prisma.aIUsage.aggregate.mockResolvedValue({ _sum: { requestCount: 0, errorCount: 0 } });
  mocks.prisma.aIUsage.upsert.mockResolvedValue({});
  mocks.prisma.appSettings.findUnique.mockResolvedValue({ timezone: 'Asia/Hebron', language: 'en' });
  mocks.study.getDailyPlan.mockResolvedValue({ groups: { CRITICAL: [], IMPORTANT: [], OPTIONAL: [] }, empty: true });
  mocks.study.getBacklog.mockResolvedValue([]);
  mocks.study.getWeeklyReview.mockResolvedValue({});
});

describe('AI tenant-safe tools', () => {
  it('rejects any model-supplied userId', async () => {
    await expect(executeAITool('getCourses', { userId: 'user-b' }, { userId: 'user-a', timezone: 'Asia/Hebron' })).rejects.toThrow();
    expect(mocks.prisma.semesterCourse.findMany).not.toHaveBeenCalled();
  });

  it('always scopes deterministic read tools to the authenticated user', async () => {
    await executeAITool('getDailyPlan', {}, { userId: 'user-a', timezone: 'Asia/Hebron' });
    await executeAITool('getBacklog', {}, { userId: 'user-a', timezone: 'Asia/Hebron' });
    expect(mocks.study.getDailyPlan).toHaveBeenCalledWith('user-a');
    expect(mocks.study.getBacklog).toHaveBeenCalledWith('user-a');
  });

  it('creates tasks only after validating the authenticated user owns the course', async () => {
    mocks.prisma.semesterCourse.findFirst.mockResolvedValue(course);
    mocks.prisma.studyTask.create.mockResolvedValue({ id: 'task-a', courseId: 'course-a', title: 'Read', type: 'OTHER', priority: 'IMPORTANT', status: 'TODO', dueAt: null });
    await executeAITool('createStudyTask', { courseId: 'course-a', title: 'Read', type: 'OTHER' }, { userId: 'user-a', timezone: 'Asia/Hebron' });
    expect(mocks.prisma.semesterCourse.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'course-a', semester: { userId: 'user-a' } } }));
    expect(mocks.prisma.studyTask.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ courseId: 'course-a', source: 'ai' }) }));
  });

  it.each([
    ['completeStudyTask', { taskId: 'foreign' }],
    ['updateLectureProgress', { lectureId: 'foreign', state: 'STUDIED' }],
    ['createAssignment', { courseId: 'foreign', title: 'Assignment', officialDeadline: '2026-10-01' }],
    ['recordGrade', { courseId: 'foreign', assessmentType: 'QUIZ', title: 'Quiz', score: 8, maximumScore: 10, date: '2026-09-17' }],
  ])('rejects foreign resources for %s', async (tool, args) => {
    await expect(executeAITool(tool, args, { userId: 'user-a', timezone: 'Asia/Hebron' })).rejects.toBeInstanceOf(AppError);
  });

  it('requires centralized confirmation before changing an exam date', async () => {
    mocks.prisma.exam.findFirst.mockResolvedValue({ id: 'exam-a', date: new Date('2026-10-01T09:00:00Z') });
    const result = await executeAITool('updateExam', { examId: 'exam-a', date: '2026-10-02' }, { userId: 'user-a', timezone: 'Asia/Hebron' }) as { requiresConfirmation: boolean };
    expect(result.requiresConfirmation).toBe(true);
    expect(mocks.prisma.exam.update).not.toHaveBeenCalled();
  });

  it('executes the exact pending exam-date change after explicit confirmation', async () => {
    mocks.prisma.exam.findFirst.mockResolvedValue({ id: 'exam-a', date: new Date('2026-10-01T09:00:00Z') });
    mocks.prisma.exam.update.mockResolvedValue({ id: 'exam-a', date: new Date('2026-10-02T09:00:00Z') });
    const pending = await executeAITool('updateExam', { examId: 'exam-a', date: '2026-10-02' }, { userId: 'user-a', timezone: 'Asia/Hebron' }) as { confirmation: { fingerprint: string } };
    await executeAITool('updateExam', { examId: 'exam-a', date: '2026-10-02' }, { userId: 'user-a', timezone: 'Asia/Hebron', approvedFingerprint: pending.confirmation.fingerprint });
    expect(mocks.prisma.exam.update).toHaveBeenCalledOnce();
  });
});

describe('AI orchestration safety', () => {
  it('enforces the tool iteration limit', async () => {
    mocks.prisma.aIConversation.findFirst.mockResolvedValue({ id: 'conversation-a', title: 'Existing' });
    mocks.prisma.aIMessage.findFirst.mockResolvedValue(null);
    mocks.prisma.aIMessage.findMany.mockResolvedValue([{ role: 'USER', content: 'loop' }]);
    mocks.prisma.aIMessage.create.mockResolvedValue({ id: 'message', role: 'USER', content: 'loop', createdAt: new Date() });
    const provider = new MockAIProvider(Array.from({ length: 4 }, (_, index) => ({ responseId: `r${index}`, text: '', toolCalls: [{ id: `c${index}`, name: 'notATool', arguments: {} }], usage: { inputTokens: 1, outputTokens: 1 } })));
    await expect(runAIConversation({ userId: 'user-a', language: 'en', timezone: 'Asia/Hebron', conversationId: 'conversation-a', message: 'loop', provider, config: enabled })).rejects.toMatchObject({ status: 502 });
  });

  it('rejects AI routes safely when the feature flag is disabled', async () => {
    const app = express(); app.use(express.json()); app.use((_request, response, next) => { response.locals.authUser = user; next(); }); app.use('/api/ai', createAIRouter({ ...enabled, enabled: false })); app.use(errorHandler);
    expect((await request(app).get('/api/ai/status')).body.data.enabled).toBe(false);
    expect((await request(app).get('/api/ai/conversations')).status).toBe(503);
  });

  it('does not expose another user conversation', async () => {
    mocks.prisma.aIConversation.findFirst.mockResolvedValue(null);
    const app = express(); app.use(express.json()); app.use((_request, response, next) => { response.locals.authUser = user; next(); }); app.use('/api/ai', createAIRouter(enabled, new MockAIProvider())); app.use(errorHandler);
    const response = await request(app).get('/api/ai/conversations/user-b-conversation');
    expect(response.status).toBe(404);
    expect(mocks.prisma.aIConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-b-conversation', userId: 'user-a' } }));
  });

  it('enforces the daily usage limit', async () => {
    mocks.prisma.aIUsage.aggregate.mockResolvedValue({ _sum: { requestCount: 10 } });
    await expect(assertDailyAILimit('user-a', { ...enabled, requestsPerDay: 10 })).rejects.toMatchObject({ status: 429 });
  });

  it('enforces the per-minute limiter', async () => {
    mocks.prisma.aIConversation.findFirst.mockResolvedValue({ id: 'conversation-a', title: 'Existing' });
    mocks.prisma.aIMessage.findFirst.mockResolvedValue(null);
    mocks.prisma.aIMessage.findMany.mockResolvedValue([{ role: 'USER', content: 'hello' }]);
    mocks.prisma.aIMessage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'message', ...data, createdAt: new Date() }));
    const app = express(); app.use(express.json()); app.use((_request, response, next) => { response.locals.authUser = user; next(); }); app.use('/api/ai', createAIRouter(enabled, new MockAIProvider())); app.use(errorHandler);
    expect((await request(app).post('/api/ai/conversations/conversation-a/messages').send({ message: 'hello' })).status).toBe(201);
    expect((await request(app).post('/api/ai/conversations/conversation-a/messages').send({ message: 'again' })).status).toBe(429);
  });
});

describe('AI token optimization', () => {
  it.each([
    ['شو لازم أدرس اليوم؟', ['getDailyPlan']],
    ['What should I study today?', ['getDailyPlan']],
    ['شو المتراكم علي؟', ['getBacklog']],
    ['What is in my backlog?', ['getBacklog']],
    ['شو وضعي بالشبكات؟', ['findCourse', 'getCourseDetails']],
  ])('selects only relevant tools for %s', (message, names) => {
    expect(selectAIToolDefinitions(message).map((tool) => tool.name)).toEqual(names);
  });

  it('bounds conversation history by both count and approximate token budget', () => {
    const history = Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? 'ASSISTANT' : 'USER', content: `${index}-${'x'.repeat(120)}` }));
    const bounded = boundAIHistory(history, 8, 100);
    expect(bounded.length).toBeLessThanOrEqual(8);
    expect(bounded.length).toBeGreaterThan(0);
    expect(estimateAIInputTokens({ instructions: '', messages: bounded, tools: [] })).toBeLessThan(160);
  });

  it('returns compact backlog DTOs without timestamps or nested model metadata', () => {
    const result = compactBacklog([{
      id: 'task-a', title: 'Review', kind: 'TASK', age: 4, risk: 70, deadline: new Date('2026-09-18'),
      course: { id: 'course-a', code: 'C1', nameAr: 'مادة', nameEn: 'Course', credits: 3, difficulty: 7, retake: false, createdAt: new Date() },
      createdAt: new Date(), updatedAt: new Date(), description: 'large internal field',
    } as never]);
    const serialized = JSON.stringify(result);
    expect(result).toMatchObject({ count: 1, items: [{ id: 'task-a', priority: 'CRITICAL', overdueDays: 4 }] });
    expect(serialized).not.toContain('createdAt');
    expect(serialized).not.toContain('updatedAt');
    expect(serialized).not.toContain('description');
    expect(serialized).not.toContain('difficulty');
  });

  it('preloads a daily plan and sends one small provider request with no unrelated schemas', async () => {
    mocks.prisma.aIConversation.findFirst.mockResolvedValue({ id: 'conversation-a', title: 'Existing' });
    mocks.prisma.aIMessage.findFirst.mockResolvedValue(null);
    mocks.prisma.aIMessage.findMany.mockResolvedValue([{ role: 'USER', content: 'شو لازم أدرس اليوم؟' }]);
    mocks.prisma.aIMessage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'message', ...data, createdAt: new Date() }));
    const provider = new MockAIProvider();
    await runAIConversation({ userId: 'user-a', language: 'ar', timezone: 'Asia/Hebron', conversationId: 'conversation-a', message: 'شو لازم أدرس اليوم؟', provider, config: enabled });
    expect(provider.inputs).toHaveLength(1);
    expect(provider.inputs[0]?.tools.map((tool) => tool.name)).toEqual(['getDailyPlan']);
    expect(provider.inputs[0]?.continuationItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tool_call', name: 'getDailyPlan' }),
      expect.objectContaining({ type: 'tool_output' }),
    ]));
    expect(estimateAIInputTokens(provider.inputs[0]!)).toBeLessThan(900);
    expect(JSON.stringify(provider.inputs[0])).not.toMatch(/getGrades|getLectureProgress|getStudentState/);
  });

  it('stops before the provider when the approximate input-token window is exhausted', async () => {
    mocks.prisma.aIConversation.findFirst.mockResolvedValue({ id: 'conversation-a', title: 'Existing' });
    mocks.prisma.aIMessage.findFirst.mockResolvedValue(null);
    mocks.prisma.aIMessage.findMany.mockResolvedValue([{ role: 'USER', content: 'hello' }]);
    mocks.prisma.aIMessage.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'message', ...data, createdAt: new Date() }));
    const provider = new MockAIProvider();
    await expect(runAIConversation({ userId: 'user-a', language: 'en', timezone: 'Asia/Hebron', conversationId: 'conversation-a', message: 'hello', provider, config: { ...enabled, inputTokenBudgetPerMinute: 1 } })).rejects.toMatchObject({ status: 429, code: 'AI_CAPACITY_LIMIT' });
    expect(provider.inputs).toHaveLength(0);
  });
});

describe('OpenAI-compatible Responses adapter', () => {
  it('uses stateless tool continuation compatible with Groq', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'response-1', output: [], usage: { input_tokens: 3, output_tokens: 2 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAIResponsesProvider({ apiKey: 'test-only-key', model: 'openai/gpt-oss-20b', baseUrl: 'https://api.groq.com/openai/v1' });
    await provider.generateResponse({
      instructions: 'test', messages: [{ role: 'user', content: 'hello' }], tools: [], maxOutputTokens: 1200, signal: new AbortController().signal,
      continuationItems: [
        { type: 'tool_call', id: 'call-1', name: 'getDailyPlan', arguments: {} },
        { type: 'tool_output', callId: 'call-1', output: { ok: true } },
      ],
    });
    const requestBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.groq.com/openai/v1/responses');
    expect(requestBody).not.toHaveProperty('previous_response_id');
    expect(requestBody.input).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'function_call', call_id: 'call-1' }),
      expect.objectContaining({ type: 'function_call_output', call_id: 'call-1' }),
    ]));
    vi.unstubAllGlobals();
  });

  it('surfaces provider 429 without exposing its response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('raw provider quota details', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAIResponsesProvider({ apiKey: 'test-only-key', model: 'openai/gpt-oss-20b', baseUrl: 'https://api.groq.com/openai/v1' });
    await expect(provider.generateResponse({ instructions: 'test', messages: [{ role: 'user', content: 'hello' }], tools: [], maxOutputTokens: 1200, signal: new AbortController().signal })).rejects.toMatchObject({ status: 429, message: 'AI provider returned 429' });
    vi.unstubAllGlobals();
  });
});
