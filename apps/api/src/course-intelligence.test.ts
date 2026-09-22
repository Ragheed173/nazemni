import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError, errorHandler } from './errors.js';
import { OpenAIResponsesProvider } from './ai/provider.js';
import { assertSafeSourceUrl } from './course-intelligence/fetch.js';
import { MockCourseExtractor } from './course-intelligence/extract.js';
import type { CourseCatalogRepository } from './course-intelligence/repository.js';
import { MockCourseSearchProvider, TavilyCourseSearchProvider } from './course-intelligence/search.js';
import { CourseIntelligenceService } from './course-intelligence/service.js';
import { defaultCourseIntelligenceConfig, type CatalogEntryView } from './course-intelligence/types.js';
import { courseLookupInput, createCourseIntelligenceRouter } from './routes/course-intelligence.js';

const config = { ...defaultCourseIntelligenceConfig, enabled: true, timeoutMs: 2000 };
const officialResult = { title: 'An-Najah University Course Catalog', url: 'https://catalog.najah.edu/courses/COMP101', description: 'COMP101 Programming, 3 credits.' };
const unofficialResult = { title: 'Course notes', url: 'https://example.com/comp101', description: 'COMP101 Programming.' };
const exact = {
  match: 'EXACT',
  course: {
    courseCode: 'COMP101', courseName: 'Introduction to Programming', credits: 3,
    description: 'Programming fundamentals.', prerequisites: ['MATH100'], topics: ['Variables', 'Functions'],
    assessmentInfo: ['Midterm', 'Final'], confidence: 0.94, conflicting: false, evidenceSourceIndexes: [1],
  },
  alternatives: [],
};

class MemoryRepository implements CourseCatalogRepository {
  entries: CatalogEntryView[] = [];
  saves = 0;
  fresh: CatalogEntryView | null = null;
  async findFresh() { return this.fresh; }
  async findById(id: string) { return this.entries.find((entry) => entry.id === id) ?? (this.fresh?.id === id ? this.fresh : null); }
  async save(input: Parameters<CourseCatalogRepository['save']>[0]) {
    this.saves += 1;
    const entry: CatalogEntryView = {
      id: `entry-${this.saves}`,
      university: input.university,
      program: input.program,
      courseCode: input.extracted.courseCode,
      courseName: input.extracted.courseName,
      credits: input.extracted.credits,
      description: input.extracted.description,
      prerequisites: input.extracted.prerequisites,
      topics: input.extracted.topics,
      assessmentInfo: input.extracted.assessmentInfo,
      officialUrl: input.officialUrl,
      status: input.status,
      confidence: input.extracted.confidence,
      lastVerifiedAt: input.checkedAt,
      sources: input.sources.map((source) => ({ ...source, excerpt: source.excerpt || null, retrievedAt: input.checkedAt })),
    };
    this.entries = [entry];
    return entry;
  }
}

const sourceFetch = async (url: string) => ({ url, contentType: 'text/plain', body: Buffer.from('COMP101 Programming fundamentals. 3 credits. Prerequisite MATH100. Topics Variables and Functions.') });

afterEach(() => vi.unstubAllGlobals());

function setup(results = [officialResult], extraction: unknown = exact) {
  const repository = new MemoryRepository();
  const search = new MockCourseSearchProvider(results);
  const extractor = new MockCourseExtractor(extraction);
  const service = new CourseIntelligenceService(config, { search, extractor, repository, fetchSource: sourceFetch });
  return { service, repository, search, extractor };
}

describe('Course Intelligence V1', () => {
  it('uses Groq-compatible JSON Schema output with low reasoning effort', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: '{"value":"ok"}',
      usage: { input_tokens: 10, output_tokens: 5 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAIResponsesProvider({ apiKey: 'test-key', model: 'openai/gpt-oss-20b', baseUrl: 'https://api.groq.com/openai/v1' });
    const schema = { type: 'object', properties: { value: { type: 'string' } }, required: ['value'], additionalProperties: false };

    await expect(provider.structuredOutput({
      instructions: 'Return a value.', messages: [{ role: 'user', content: 'test' }], tools: [],
      maxOutputTokens: 1200, signal: new AbortController().signal,
    }, schema)).resolves.toEqual({ value: 'ok' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      reasoning: { effort: 'low' },
      text: { format: { type: 'json_schema', name: 'nazemni_structured_output', schema, strict: true } },
    });
  });

  it('maps Tavily search responses into provider-neutral results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [
        { title: 'Official catalog', url: 'https://catalog.example.edu/COMP101', content: 'Programming, 3 credits.' },
        { title: 'Unsafe result', url: 'file:///etc/passwd', content: 'ignored' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new TavilyCourseSearchProvider('test-key', 'https://api.tavily.com/search');
    const results = await provider.search('COMP101', 5, new AbortController().signal);

    expect(results).toEqual([{ title: 'Official catalog', url: 'https://catalog.example.edu/COMP101', description: 'Programming, 3 credits.' }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.tavily.com/search');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      query: 'COMP101',
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_usage: true,
    });
  });

  it('caps Tavily queries at the provider-recommended 400 characters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new TavilyCourseSearchProvider('test-key', 'https://api.tavily.com/search');
    await provider.search('x'.repeat(450), 5, new AbortController().signal);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).query).toHaveLength(400);
  });

  it('stores an exact official course match as verified', async () => {
    const { service, repository } = setup();
    const result = await service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'Introduction to Programming' });
    expect(result.outcome).toBe('FOUND');
    expect(result.outcome === 'FOUND' && result.entry.status).toBe('VERIFIED');
    expect(result.outcome === 'FOUND' && result.entry.sources[0]?.isOfficial).toBe(true);
    expect(repository.saves).toBe(1);
  });

  it('matches a course-code lookup without changing the extracted code', async () => {
    const { service } = setup();
    const result = await service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'COMP101' });
    expect(result.outcome === 'FOUND' && result.entry.courseCode).toBe('COMP101');
  });

  it('returns ambiguous alternatives without storing a guessed entry', async () => {
    const { service, repository } = setup([officialResult], { match: 'AMBIGUOUS', alternatives: [{ courseCode: 'COMP101', courseName: 'Programming I' }, { courseCode: 'COMP110', courseName: 'Programming' }] });
    const result = await service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'Programming' });
    expect(result.outcome).toBe('AMBIGUOUS');
    expect(repository.saves).toBe(0);
  });

  it('returns Not verified when search produces no results', async () => {
    const { service, extractor } = setup([]);
    const result = await service.lookup({ university: 'Unknown University', program: 'Science', query: 'ABC100' });
    expect(result.outcome).toBe('NOT_VERIFIED');
    expect(extractor.calls).toBe(0);
  });

  it('keeps unofficial-only information clearly unverified', async () => {
    const { service } = setup([unofficialResult]);
    const result = await service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'COMP101' });
    expect(result.outcome === 'FOUND' && result.entry.status).toBe('NOT_VERIFIED');
    expect(result.outcome === 'FOUND' && result.entry.officialUrl).toBeNull();
  });

  it('marks conflicting official sources as partially verified', async () => {
    const conflicting = { ...exact, course: { ...exact.course, conflicting: true } };
    const { service } = setup([officialResult], conflicting);
    const result = await service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'COMP101' });
    expect(result.outcome === 'FOUND' && result.entry.status).toBe('PARTIAL');
  });

  it('reuses a fresh cached entry without search or AI', async () => {
    const { service, repository, search, extractor } = setup();
    const created = await service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'COMP101' });
    if (created.outcome !== 'FOUND') throw new Error('test setup failed');
    repository.fresh = created.entry;
    const cached = await service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'COMP101' });
    expect(cached.outcome === 'FOUND' && cached.cached).toBe(true);
    expect(search.calls).toBe(1);
    expect(extractor.calls).toBe(1);
  });

  it('manual refresh bypasses a fresh cache', async () => {
    const { service, repository, search } = setup();
    const created = await service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'COMP101' });
    if (created.outcome !== 'FOUND') throw new Error('test setup failed');
    repository.fresh = created.entry;
    await service.refresh(created.entry.id);
    expect(search.calls).toBe(2);
  });

  it('rejects malformed structured AI output instead of storing it', async () => {
    const { service, repository } = setup([officialResult], { match: 'EXACT', course: { courseCode: 'COMP101' }, alternatives: [] });
    await expect(service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'COMP101' }))
      .rejects.toMatchObject({ status: 502, code: 'COURSE_EXTRACTION_FAILED' });
    expect(repository.saves).toBe(0);
  });

  it('rejects client-supplied ownership fields', () => {
    expect(courseLookupInput.safeParse({ university: 'A University', program: 'Science', query: 'ABC100', userId: 'other-user' }).success).toBe(false);
  });

  it('rejects tutoring requests and answers facts only from the cache', async () => {
    const { service } = setup();
    const created = await service.lookup({ university: 'An-Najah University', program: 'Computer Science', query: 'COMP101' });
    if (created.outcome !== 'FOUND') throw new Error('test setup failed');
    await expect(service.answer(created.entry.id, 'Explain chapter 3', 'en')).rejects.toMatchObject({ code: 'COURSE_INTELLIGENCE_SCOPE' });
    await expect(service.answer(created.entry.id, 'How many credits?', 'en')).resolves.toBe('3 credits.');
  });

  it.each([
    ['http://localhost/course', ['127.0.0.1']],
    ['http://169.254.169.254/latest/meta-data', ['169.254.169.254']],
    ['https://private.example/course', ['10.0.0.8']],
    ['file:///etc/passwd', ['93.184.216.34']],
  ])('blocks SSRF target %s', async (url, resolved) => {
    await expect(assertSafeSourceUrl(url, async () => resolved)).rejects.toBeInstanceOf(AppError);
  });

  it('keeps routes unavailable when the feature flag is off', async () => {
    const app = express();
    app.use(express.json());
    app.use((_request, response, next) => { response.locals.authUser = { id: 'user-a', preferredLanguage: 'en' }; next(); });
    app.use('/api/course-intelligence', createCourseIntelligenceRouter(defaultCourseIntelligenceConfig));
    app.use(errorHandler);
    expect((await request(app).get('/api/course-intelligence/status')).body.data).toEqual({ enabled: false });
    const response = await request(app).post('/api/course-intelligence/lookup').send({ university: 'A', program: 'B', query: 'C' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('FEATURE_DISABLED');
  });
});
