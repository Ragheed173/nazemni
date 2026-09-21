import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from './db.js';
import { entityRouter } from './routes/entities.js';
import { createAdminRouter } from './routes/account.js';
import { getBacklog, getDailyPlan, getWeeklyReview } from './services/study.js';

const userA = {
  id: 'user-a', email: 'a@example.test', name: 'A', username: 'a-user',
  role: 'USER', status: 'ACTIVE', preferredLanguage: 'ar', createdAt: new Date(),
} as const;

function userApp(router = entityRouter) {
  const app = express();
  app.use(express.json());
  app.use((_request, response, next) => { response.locals.authUser = userA; next(); });
  app.use('/api', router);
  app.use((error: { status?: number }, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    void next;
    response.status(error.status ?? 500).json({ ok: false });
  });
  return app;
}

describe('multi-tenant ownership boundaries', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('does not return another user course by ID', async () => {
    const lookup = vi.spyOn(prisma.semesterCourse, 'findFirst').mockResolvedValue(null);
    const response = await request(userApp()).get('/api/courses/user-b-course');
    expect(response.status).toBe(404);
    expect(lookup).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-b-course', semester: { userId: 'user-a' } },
    }));
  });

  it('cannot attach a lecture to another user enrollment', async () => {
    const count = vi.spyOn(prisma.semesterCourse, 'count').mockResolvedValue(0);
    const response = await request(userApp()).post('/api/lectures').send({
      courseId: 'user-b-course', number: 1, title: 'Private lecture', lectureDate: new Date().toISOString(),
    });
    expect(response.status).toBe(404);
    expect(count).toHaveBeenCalledWith({ where: { id: 'user-b-course', semester: { userId: 'user-a' } } });
  });

  it('cannot patch or delete another user task or grade', async () => {
    vi.spyOn(prisma.studyTask, 'findFirst').mockResolvedValue(null);
    const patchResponse = await request(userApp()).patch('/api/tasks/user-b-task').send({ status: 'COMPLETED' });
    expect(patchResponse.status).toBe(404);

    const deleteMany = vi.spyOn(prisma.grade, 'deleteMany').mockResolvedValue({ count: 0 });
    const deleteResponse = await request(userApp()).delete('/api/grades/user-b-grade');
    expect(deleteResponse.status).toBe(404);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'user-b-grade', course: { semester: { userId: 'user-a' } } } });
  });

  it('scopes grade enumeration to the authenticated user', async () => {
    const findMany = vi.spyOn(prisma.grade, 'findMany').mockResolvedValue([]);
    const response = await request(userApp()).get('/api/grades');
    expect(response.status).toBe(200);
    expect(findMany.mock.calls[0]?.[0]?.where).toEqual(expect.objectContaining({
      course: { enrollmentStatus: 'ACTIVE', semester: { isCurrent: true, userId: 'user-a' } },
    }));
  });

  it('rejects a normal user from admin APIs', async () => {
    const response = await request(userApp(createAdminRouter('INVITE_ONLY'))).get('/api/summary');
    expect(response.status).toBe(403);
  });
});

describe('lecture backlog API', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates a lecture without client-supplied title or number', async () => {
    vi.spyOn(prisma.semesterCourse, 'count').mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    vi.spyOn(prisma.lecture, 'aggregate').mockResolvedValue({ _max: { number: 3 } } as never);
    const create = vi.spyOn(prisma.lecture, 'create').mockResolvedValue({
      id: 'lecture-4', courseId: 'course-a', number: 4, title: 'Backlogged Lecture 4',
      lectureDate: new Date('2026-09-21'), takenAtUniversity: false, durationMinutes: 75,
      deliveryMode: 'ONLINE', attended: false, state: 'STUDIED', understandingScore: null,
      notes: 'QA note', needsReview: true, studiedAt: null, lastReviewedAt: null,
      masteredAt: null, createdAt: new Date(), updatedAt: new Date(),
      course: { id: 'course-a', difficulty: 7, catalog: { courseCode: 'QA101', nameEn: 'QA', nameAr: 'اختبار', defaultCredits: 3, archived: false } },
    } as never);

    const response = await request(userApp()).post('/api/lectures').send({
      courseId: 'course-a', lectureDate: '2026-09-21', durationMinutes: 75,
      deliveryMode: 'ONLINE', attended: false, needsReview: true, notes: 'QA note', state: 'STUDIED',
    });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        number: 4, title: 'Backlogged Lecture 4', durationMinutes: 75,
        deliveryMode: 'ONLINE', attended: false, needsReview: true, takenAtUniversity: false,
      }),
    }));
  });

  it('persists editable lecture backlog fields', async () => {
    vi.spyOn(prisma.lecture, 'findFirst').mockResolvedValue({ id: 'lecture-1', courseId: 'course-a' } as never);
    const update = vi.spyOn(prisma.lecture, 'update').mockResolvedValue({
      id: 'lecture-1', courseId: 'course-a', number: 1, title: 'Existing lecture',
      lectureDate: new Date('2026-09-22'), takenAtUniversity: true, durationMinutes: 90,
      deliveryMode: 'IN_PERSON', attended: true, state: 'TAKEN_NOT_STUDIED', understandingScore: null,
      notes: 'Updated', needsReview: false, studiedAt: null, lastReviewedAt: null,
      masteredAt: null, createdAt: new Date(), updatedAt: new Date(),
      course: { id: 'course-a', catalog: { courseCode: 'QA101', nameEn: 'QA', nameAr: 'اختبار', defaultCredits: 3, archived: false } },
    } as never);

    const response = await request(userApp()).patch('/api/lectures/lecture-1').send({
      lectureDate: '2026-09-22', durationMinutes: 90, deliveryMode: 'IN_PERSON',
      attended: true, needsReview: false, notes: 'Updated',
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        durationMinutes: 90, deliveryMode: 'IN_PERSON', attended: true,
        needsReview: false, notes: 'Updated', takenAtUniversity: true,
      }),
    }));
  });
});

describe('planning isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.studyTask, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.studyTask, 'groupBy').mockResolvedValue([]);
    vi.spyOn(prisma.lecture, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.assignment, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.project, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.exam, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.review, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.weakTopic, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.grade, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.semesterCourse, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.appSettings, 'findUnique').mockResolvedValue(null);
  });

  it('daily plan and backlog queries carry the authenticated user ID', async () => {
    await getDailyPlan('user-a', new Date('2026-09-17T10:00:00Z'));
    await getBacklog('user-a', new Date('2026-09-17T10:00:00Z'));
    const calls = [
      ...vi.mocked(prisma.studyTask.findMany).mock.calls,
      ...vi.mocked(prisma.lecture.findMany).mock.calls,
      ...vi.mocked(prisma.assignment.findMany).mock.calls,
    ];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => JSON.stringify(call[0]).includes('user-a'))).toBe(true);
    expect(calls.some((call) => JSON.stringify(call[0]).includes('user-b'))).toBe(false);
  });

  it('weekly review never performs an unscoped academic query', async () => {
    await getWeeklyReview('user-a', new Date('2026-09-17T10:00:00Z'));
    const calls = [
      ...vi.mocked(prisma.studyTask.findMany).mock.calls,
      ...vi.mocked(prisma.studyTask.groupBy).mock.calls,
      ...vi.mocked(prisma.semesterCourse.findMany).mock.calls,
      ...vi.mocked(prisma.grade.findMany).mock.calls,
    ];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => JSON.stringify(call[0]).includes('user-a'))).toBe(true);
  });
});
