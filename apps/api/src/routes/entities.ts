import { Router } from 'express';
import { calculateCourseStatus, calculateGradeStanding, reviewDelayDays } from '@nazemni/shared';
import { prisma } from '../db.js';
import { activeEnrollmentFilter } from '../course-view.js';
import { AppError } from '../errors.js';
import { authUser } from '../auth.js';
import {
  assignmentInput,
  examInput,
  gradeInput,
  lectureInput,
  projectInput,
  taskInput,
  weakTopicInput,
} from '../schemas.js';

export const entityRouter = Router();
const normalize = (value: unknown): unknown => {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const normalized = Object.fromEntries(Object.entries(source).map(([key, item]) => [key, normalize(item)]));
  const catalog = normalized.catalog as Record<string, unknown> | undefined;
  if (catalog?.courseCode) {
    delete normalized.catalog;
    return {
      ...normalized,
      code: catalog.courseCode,
      courseCode: catalog.courseCode,
      nameEn: catalog.nameEn,
      nameAr: catalog.nameAr,
      defaultCredits: catalog.defaultCredits,
      archived: catalog.archived,
    };
  }
  return normalized;
};
const ok = (data: unknown) => ({ ok: true, data: normalize(data) });
const daysFromNow = (date: Date) => Math.ceil((date.getTime() - Date.now()) / 86_400_000);
const ensureOwnedCourse = async (userId: string, courseId: string) => {
  const count = await prisma.semesterCourse.count({ where: { id: courseId, semester: { userId } } });
  if (!count) throw new AppError(404, 'Resource not found');
};
const ensureAssessmentEnabled = async (userId: string, courseId: string, type: 'QUIZ' | 'ASSIGNMENT' | 'PROJECT' | 'MIDTERM' | 'FINAL' | 'PARTICIPATION' | 'OTHER') => {
  await ensureOwnedCourse(userId, courseId);
  const configured = await prisma.assessmentComponent.count({ where: { semesterCourseId: courseId, enabled: true } });
  if (!configured) return;
  const enabled = await prisma.assessmentComponent.findFirst({ where: { semesterCourseId: courseId, type, enabled: true } });
  if (!enabled) throw new AppError(400, 'This assessment type is not enabled for the selected course');
};
const deriveStatus = (course: {
  lectures: Array<{ state: string }>;
  weakTopics: Array<{ severity: string; resolved: boolean }>;
  assignments: Array<{ officialDeadline: Date; status: string }>;
  exams: Array<{ date: Date }>;
  lastStudyAt: Date | null;
  grades: Array<{ score: number; maximumScore: number; weight: number | null }>;
}) => {
  const studied = course.lectures.filter((x) => x.state !== 'TAKEN_NOT_STUDIED').length;
  const standing = calculateGradeStanding(course.grades.map((x) => ({ score: x.score, maximum: x.maximumScore, weight: x.weight })));
  const nextExam = course.exams.map((x) => daysFromNow(x.date)).filter((days) => days >= 0).sort((a, b) => a - b)[0];
  return calculateCourseStatus({
    backlogCount: course.lectures.length - studied,
    highWeakTopics: course.weakTopics.filter((x) => !x.resolved && x.severity === 'HIGH').length,
    overdueAssessments: course.assignments.filter((x) => x.officialDeadline < new Date() && !['SUBMITTED', 'GRADED'].includes(x.status)).length,
    lectureCompletion: course.lectures.length ? studied / course.lectures.length * 100 : 100,
    daysSinceStudy: course.lastStudyAt ? Math.max(0, -daysFromNow(course.lastStudyAt)) : 7,
    currentWeightedScore: standing.current,
    examWithinDays: nextExam ?? null,
    weeklyCovered: Boolean(course.lastStudyAt && -daysFromNow(course.lastStudyAt) <= 7),
  });
};

entityRouter.get('/courses', async (_req, res) => {
  const userId = authUser(res).id;
  const data = await prisma.semesterCourse.findMany({
    where: activeEnrollmentFilter(userId),
    include: {
      catalog: true,
      _count: { select: { lectures: true, tasks: true, assignments: true, projects: true, exams: true, weakTopics: true } },
      lectures: { select: { state: true } },
      weakTopics: { select: { severity: true, resolved: true } },
      assignments: { select: { officialDeadline: true, status: true } },
      exams: { select: { date: true } },
      grades: true,
    },
    orderBy: [{ difficulty: 'desc' }, { catalog: { nameEn: 'asc' } }],
  });
  res.json(ok(data.map((course) => ({
    ...course,
    status: deriveStatus(course),
    lectureProgress: course.lectures.length
      ? Math.round(course.lectures.filter((x) => x.state !== 'TAKEN_NOT_STUDIED').length / course.lectures.length * 100)
      : 0,
    gradeStanding: calculateGradeStanding(course.grades.map((x) => ({ score: x.score, maximum: x.maximumScore, weight: x.weight }))),
  }))));
});

entityRouter.get('/courses/:id', async (req, res) => {
  const userId = authUser(res).id;
  const course = await prisma.semesterCourse.findFirst({
    where: { id: req.params.id, semester: { userId } },
    include: {
      catalog: true,
      schedule: { orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }] },
      assessmentComponents: { where: { enabled: true }, orderBy: { order: 'asc' } },
      lectures: { orderBy: { number: 'asc' } },
      assignments: { orderBy: { officialDeadline: 'asc' } },
      projects: { include: { milestones: { orderBy: { order: 'asc' } } }, orderBy: { officialDeadline: 'asc' } },
      exams: { orderBy: { date: 'asc' } },
      grades: { orderBy: { date: 'desc' } },
      weakTopics: { orderBy: [{ resolved: 'asc' }, { severity: 'desc' }] },
      tasks: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
  if (!course) throw new AppError(404, 'Resource not found');
  res.json(ok({
    ...course,
    status: deriveStatus(course),
    gradeStanding: calculateGradeStanding(course.grades.map((x) => ({ score: x.score, maximum: x.maximumScore, weight: x.weight }))),
  }));
});

entityRouter.get('/schedule', async (_req, res) => {
  const userId = authUser(res).id;
  res.json(ok(await prisma.scheduleSlot.findMany({ where: { course: activeEnrollmentFilter(userId) }, include: { course: { include: { catalog: true } } }, orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }] })));
});

entityRouter.get('/lectures', async (req, res) => {
  const userId = authUser(res).id;
  res.json(ok(await prisma.lecture.findMany({
    where: { ...(req.query.courseId ? { courseId: String(req.query.courseId) } : {}), course: activeEnrollmentFilter(userId) },
    include: { course: { include: { catalog: true } } },
    orderBy: [{ lectureDate: 'desc' }, { number: 'desc' }],
  })));
});

entityRouter.post('/lectures', async (req, res) => {
  const userId = authUser(res).id;
  const input = lectureInput.parse(req.body);
  await ensureOwnedCourse(userId, input.courseId);
  const activeCourse = await prisma.semesterCourse.count({ where: { id: input.courseId, ...activeEnrollmentFilter(userId) } });
  if (!activeCourse) throw new AppError(404, 'Resource not found');
  const nextNumber = input.number ?? ((await prisma.lecture.aggregate({ where: { courseId: input.courseId }, _max: { number: true } }))._max.number ?? 0) + 1;
  const deliveryMode = req.body.deliveryMode ? input.deliveryMode : (input.takenAtUniversity === false ? 'ONLINE' : input.deliveryMode);
  const lecture = await prisma.lecture.create({
    data: {
      courseId: input.courseId,
      number: nextNumber,
      title: input.title ?? `Backlogged Lecture ${nextNumber}`,
      lectureDate: input.lectureDate,
      takenAtUniversity: deliveryMode === 'IN_PERSON',
      durationMinutes: input.durationMinutes,
      deliveryMode,
      attended: input.attended,
      state: input.state,
      understandingScore: input.understandingScore,
      notes: input.notes,
      needsReview: input.needsReview,
    },
    include: { course: { include: { catalog: true } } },
  });
  if (lecture.state === 'TAKEN_NOT_STUDIED') {
    await prisma.studyTask.create({
      data: {
        courseId: lecture.courseId,
        lectureId: lecture.id,
        title: 'Study Lecture ' + lecture.number + ': ' + lecture.title,
        type: 'LECTURE',
        priority: lecture.course.difficulty >= 8 ? 'IMPORTANT' : 'OPTIONAL',
        source: 'lecture',
      },
    });
  }
  res.status(201).json(ok(lecture));
});

entityRouter.patch('/lectures/:id', async (req, res) => {
  const userId = authUser(res).id;
  const input = lectureInput.partial().parse(req.body);
  const existing = await prisma.lecture.findFirst({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!existing) throw new AppError(404, 'Resource not found');
  if (input.courseId) await ensureOwnedCourse(userId, input.courseId);
  const data = {
    ...input,
    ...(input.deliveryMode ? { takenAtUniversity: input.deliveryMode === 'IN_PERSON' } : {}),
    studiedAt: input.state && input.state !== 'TAKEN_NOT_STUDIED' ? new Date() : undefined,
    masteredAt: input.state === 'MASTERED' ? new Date() : undefined,
  };
  const lecture = await prisma.lecture.update({ where: { id: existing.id }, data, include: { course: { include: { catalog: true } } } });
  if (input.state && input.state !== 'TAKEN_NOT_STUDIED') {
    await prisma.studyTask.updateMany({ where: { lectureId: lecture.id, status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED', completedAt: new Date() } });
    if (input.understandingScore) {
      const delay = reviewDelayDays(lecture.course.difficulty, input.understandingScore, input.needsReview);
      const settings = await prisma.appSettings.findUnique({ where: { userId } });
      const delayMs = delay === 1
        ? (settings?.firstReviewHours ?? 24) * 3_600_000
        : delay * 86_400_000;
      await prisma.review.create({
        data: {
          courseId: lecture.courseId,
          lectureId: lecture.id,
          type: 'FIRST_REVIEW',
          scheduledAt: new Date(Date.now() + delayMs),
        },
      });
    }
    await prisma.semesterCourse.update({ where: { id: lecture.courseId }, data: { lastStudyAt: new Date() } });
  }
  res.json(ok(lecture));
});

entityRouter.delete('/lectures/:id', async (req, res) => {
  const userId = authUser(res).id;
  const deleted = await prisma.lecture.deleteMany({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!deleted.count) throw new AppError(404, 'Resource not found');
  res.status(204).end();
});

entityRouter.get('/tasks', async (req, res) => {
  const userId = authUser(res).id;
  res.json(ok(await prisma.studyTask.findMany({
    where: {
      ...(req.query.status ? { status: String(req.query.status) as never } : {}),
      ...(req.query.courseId ? { courseId: String(req.query.courseId) } : {}),
      course: activeEnrollmentFilter(userId),
    },
    include: { course: { include: { catalog: true } }, lecture: true },
    orderBy: [{ status: 'asc' }, { priorityScore: 'desc' }, { dueAt: 'asc' }],
  })));
});

entityRouter.post('/tasks', async (req, res) => {
  const userId = authUser(res).id;
  const input = taskInput.parse(req.body);
  await ensureOwnedCourse(userId, input.courseId);
  if (input.lectureId) {
    const lecture = await prisma.lecture.count({ where: { id: input.lectureId, courseId: input.courseId, course: { semester: { userId } } } });
    if (!lecture) throw new AppError(404, 'Resource not found');
  }
  const data = await prisma.studyTask.create({ data: input, include: { course: { include: { catalog: true } } } });
  res.status(201).json(ok(data));
});

entityRouter.patch('/tasks/:id', async (req, res) => {
  const userId = authUser(res).id;
  const input = taskInput.partial().parse(req.body);
  const existing = await prisma.studyTask.findFirst({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!existing) throw new AppError(404, 'Resource not found');
  if (input.courseId) await ensureOwnedCourse(userId, input.courseId);
  if (input.lectureId) {
    const lecture = await prisma.lecture.count({
      where: { id: input.lectureId, courseId: input.courseId ?? existing.courseId, course: { semester: { userId } } },
    });
    if (!lecture) throw new AppError(404, 'Resource not found');
  }
  const data = await prisma.studyTask.update({
    where: { id: req.params.id },
    data: {
      ...input,
      completedAt: input.status === 'COMPLETED' ? new Date() : input.status ? null : undefined,
      deferredCount: input.status === 'DEFERRED' && existing.status !== 'DEFERRED' ? { increment: 1 } : undefined,
    },
    include: { course: { include: { catalog: true } } },
  });
  if (input.status === 'COMPLETED') await prisma.semesterCourse.update({ where: { id: data.courseId }, data: { lastStudyAt: new Date() } });
  res.json(ok(data));
});

entityRouter.delete('/tasks/:id', async (req, res) => {
  const userId = authUser(res).id;
  const deleted = await prisma.studyTask.deleteMany({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!deleted.count) throw new AppError(404, 'Resource not found');
  res.status(204).end();
});

entityRouter.get('/assignments', async (req, res) => {
  const userId = authUser(res).id;
  res.json(ok(await prisma.assignment.findMany({ where: { ...(req.query.courseId ? { courseId: String(req.query.courseId) } : {}), course: activeEnrollmentFilter(userId) }, include: { course: { include: { catalog: true } } }, orderBy: { officialDeadline: 'asc' } })));
});

entityRouter.post('/assignments', async (req, res) => {
  const userId = authUser(res).id;
  const input = assignmentInput.parse(req.body);
  await ensureAssessmentEnabled(userId, input.courseId, 'ASSIGNMENT');
  const course = await prisma.semesterCourse.findFirstOrThrow({ where: { id: input.courseId, semester: { userId } } });
  const bufferDays = Math.min(4, Math.max(1, Math.ceil((input.weight ?? 10) / 10) + (course.difficulty >= 8 ? 1 : 0)));
  const data = await prisma.assignment.create({
    data: {
      ...input,
      internalDeadline: input.internalDeadline ?? new Date(input.officialDeadline.getTime() - bufferDays * 86_400_000),
    },
    include: { course: { include: { catalog: true } } },
  });
  res.status(201).json(ok(data));
});

entityRouter.patch('/assignments/:id', async (req, res) => {
  const userId = authUser(res).id;
  const input = assignmentInput.partial().parse(req.body);
  const existing = await prisma.assignment.findFirst({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!existing) throw new AppError(404, 'Resource not found');
  if (input.courseId) await ensureOwnedCourse(userId, input.courseId);
  res.json(ok(await prisma.assignment.update({ where: { id: existing.id }, data: input, include: { course: { include: { catalog: true } } } })));
});

entityRouter.delete('/assignments/:id', async (req, res) => {
  const userId = authUser(res).id;
  const deleted = await prisma.assignment.deleteMany({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!deleted.count) throw new AppError(404, 'Resource not found');
  res.status(204).end();
});

entityRouter.get('/projects', async (req, res) => {
  const userId = authUser(res).id;
  res.json(ok(await prisma.project.findMany({ where: { ...(req.query.courseId ? { courseId: String(req.query.courseId) } : {}), course: activeEnrollmentFilter(userId) }, include: { course: { include: { catalog: true } }, milestones: { orderBy: { order: 'asc' } } }, orderBy: { officialDeadline: 'asc' } })));
});

entityRouter.post('/projects', async (req, res) => {
  const userId = authUser(res).id;
  const { addDefaultMilestones, ...input } = projectInput.parse(req.body);
  await ensureAssessmentEnabled(userId, input.courseId, 'PROJECT');
  const course = await prisma.semesterCourse.findFirstOrThrow({ where: { id: input.courseId, semester: { userId } } });
  const bufferDays = Math.min(7, Math.max(3, Math.ceil((input.weight ?? 20) / 8) + (course.difficulty >= 8 ? 1 : 0)));
  const defaultMilestones = ['Understand Requirements', 'Setup / Research', 'Implementation', 'Testing', 'Final Polish', 'Submission'];
  const data = await prisma.project.create({
    data: {
      ...input,
      internalDeadline: input.internalDeadline ?? new Date(input.officialDeadline.getTime() - bufferDays * 86_400_000),
      milestones: addDefaultMilestones ? { create: defaultMilestones.map((title, order) => ({ title, order })) } : undefined,
    },
    include: { course: { include: { catalog: true } }, milestones: { orderBy: { order: 'asc' } } },
  });
  res.status(201).json(ok(data));
});

entityRouter.patch('/projects/:id', async (req, res) => {
  const userId = authUser(res).id;
  const input = projectInput.partial().omit({ addDefaultMilestones: true }).parse(req.body);
  const existing = await prisma.project.findFirst({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!existing) throw new AppError(404, 'Resource not found');
  if (input.courseId) await ensureOwnedCourse(userId, input.courseId);
  res.json(ok(await prisma.project.update({ where: { id: existing.id }, data: input, include: { course: { include: { catalog: true } }, milestones: { orderBy: { order: 'asc' } } } })));
});

entityRouter.patch('/milestones/:id', async (req, res) => {
  const userId = authUser(res).id;
  const input = req.body as { status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; title?: string; notes?: string; dueAt?: string | null };
  const existing = await prisma.projectMilestone.findFirst({ where: { id: req.params.id, project: { course: { semester: { userId } } } } });
  if (!existing) throw new AppError(404, 'Resource not found');
  const data = await prisma.projectMilestone.update({
    where: { id: existing.id },
    data: { ...input, dueAt: input.dueAt ? new Date(input.dueAt) : input.dueAt, completedAt: input.status === 'COMPLETED' ? new Date() : input.status ? null : undefined },
  });
  const all = await prisma.projectMilestone.findMany({ where: { projectId: data.projectId } });
  await prisma.project.update({ where: { id: data.projectId }, data: { progress: Math.round(all.filter((x) => x.status === 'COMPLETED').length / all.length * 100) } });
  res.json(ok(data));
});

entityRouter.delete('/projects/:id', async (req, res) => {
  const userId = authUser(res).id;
  const deleted = await prisma.project.deleteMany({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!deleted.count) throw new AppError(404, 'Resource not found');
  res.status(204).end();
});

entityRouter.get('/exams', async (req, res) => {
  const userId = authUser(res).id;
  res.json(ok(await prisma.exam.findMany({ where: { ...(req.query.courseId ? { courseId: String(req.query.courseId) } : {}), course: activeEnrollmentFilter(userId) }, include: { course: { include: { catalog: true } } }, orderBy: { date: 'asc' } })));
});

entityRouter.post('/exams', async (req, res) => {
  const userId = authUser(res).id;
  const input = examInput.parse(req.body);
  await ensureAssessmentEnabled(userId, input.courseId, input.type);
  const course = await prisma.semesterCourse.findFirstOrThrow({ where: { id: input.courseId, semester: { userId } } });
  const leadDays = course.difficulty >= 8 ? 8 : 6;
  const data = await prisma.exam.create({
    data: { ...input, preparationStartAt: input.preparationStartAt ?? new Date(input.date.getTime() - leadDays * 86_400_000) },
    include: { course: { include: { catalog: true } } },
  });
  const taskTitles = ['Review covered lectures', 'Review weak topics', 'Practice previous exams', 'Final review'];
  await prisma.studyTask.createMany({
    data: taskTitles.map((title, index) => ({
      courseId: data.courseId,
      title: title + ' — ' + data.title,
      type: index === 2 ? 'PRACTICE' : 'EXAM_PREP',
      priority: 'IMPORTANT',
      dueAt: new Date(data.date.getTime() - Math.max(1, leadDays - index * 2) * 86_400_000),
      source: 'exam:' + data.id,
      estimatedEffort: index === 2 ? 45 : 30,
    })),
  });
  res.status(201).json(ok(data));
});

entityRouter.patch('/exams/:id', async (req, res) => {
  const userId = authUser(res).id;
  const input = examInput.partial().parse(req.body);
  const existing = await prisma.exam.findFirst({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!existing) throw new AppError(404, 'Resource not found');
  if (input.courseId) await ensureOwnedCourse(userId, input.courseId);
  res.json(ok(await prisma.exam.update({ where: { id: existing.id }, data: input, include: { course: { include: { catalog: true } } } })));
});

entityRouter.delete('/exams/:id', async (req, res) => {
  const userId = authUser(res).id;
  const deleted = await prisma.exam.deleteMany({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!deleted.count) throw new AppError(404, 'Resource not found');
  res.status(204).end();
});

entityRouter.get('/grades', async (req, res) => {
  const userId = authUser(res).id;
  const grades = await prisma.grade.findMany({ where: { ...(req.query.courseId ? { courseId: String(req.query.courseId) } : {}), course: activeEnrollmentFilter(userId) }, include: { course: { include: { catalog: true } } }, orderBy: { date: 'desc' } });
  const grouped = grades.reduce<Record<string, typeof grades>>((result, grade) => {
    (result[grade.courseId] ??= []).push(grade);
    return result;
  }, {});
  res.json(ok({
    grades,
    standing: Object.fromEntries(Object.entries(grouped).map(([courseId, items]) => [
      courseId,
      calculateGradeStanding((items ?? []).map((x) => ({ score: x.score, maximum: x.maximumScore, weight: x.weight }))),
    ])),
  }));
});

entityRouter.post('/grades', async (req, res) => {
  const userId = authUser(res).id;
  const input = gradeInput.parse(req.body);
  await ensureAssessmentEnabled(userId, input.courseId, input.assessmentType);
  if (input.score > input.maximumScore) {
    res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Score cannot exceed maximum score' } });
    return;
  }
  const data = await prisma.grade.create({ data: input, include: { course: { include: { catalog: true } } } });
  res.status(201).json(ok(data));
});

entityRouter.patch('/grades/:id', async (req, res) => {
  const userId = authUser(res).id;
  const input = gradeInput.partial().parse(req.body);
  const existing = await prisma.grade.findFirst({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!existing) throw new AppError(404, 'Resource not found');
  if (input.courseId) await ensureOwnedCourse(userId, input.courseId);
  res.json(ok(await prisma.grade.update({ where: { id: existing.id }, data: input, include: { course: { include: { catalog: true } } } })));
});

entityRouter.delete('/grades/:id', async (req, res) => {
  const userId = authUser(res).id;
  const deleted = await prisma.grade.deleteMany({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!deleted.count) throw new AppError(404, 'Resource not found');
  res.status(204).end();
});

entityRouter.get('/weak-topics', async (req, res) => {
  const userId = authUser(res).id;
  res.json(ok(await prisma.weakTopic.findMany({ where: { ...(req.query.courseId ? { courseId: String(req.query.courseId) } : {}), course: activeEnrollmentFilter(userId) }, include: { course: { include: { catalog: true } } }, orderBy: [{ resolved: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }] })));
});

entityRouter.post('/weak-topics', async (req, res) => {
  const userId = authUser(res).id;
  const input = weakTopicInput.parse(req.body);
  await ensureOwnedCourse(userId, input.courseId);
  const topic = await prisma.weakTopic.create({ data: input, include: { course: { include: { catalog: true } } } });
  await prisma.review.create({
    data: {
      courseId: topic.courseId,
      weakTopicId: topic.id,
      type: 'WEAK_TOPIC_REVIEW',
      scheduledAt: new Date(Date.now() + (topic.severity === 'HIGH' ? 1 : topic.severity === 'MEDIUM' ? 3 : 7) * 86_400_000),
    },
  });
  res.status(201).json(ok(topic));
});

entityRouter.patch('/weak-topics/:id', async (req, res) => {
  const userId = authUser(res).id;
  const input = weakTopicInput.partial().parse(req.body);
  const existing = await prisma.weakTopic.findFirst({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!existing) throw new AppError(404, 'Resource not found');
  if (input.courseId) await ensureOwnedCourse(userId, input.courseId);
  const resolved = typeof req.body.resolved === 'boolean' ? req.body.resolved : undefined;
  const data = await prisma.weakTopic.update({
    where: { id: existing.id },
    data: { ...input, resolved, resolvedAt: resolved === true ? new Date() : resolved === false ? null : undefined },
    include: { course: { include: { catalog: true } } },
  });
  res.json(ok(data));
});

entityRouter.delete('/weak-topics/:id', async (req, res) => {
  const userId = authUser(res).id;
  const deleted = await prisma.weakTopic.deleteMany({ where: { id: req.params.id, course: { semester: { userId } } } });
  if (!deleted.count) throw new AppError(404, 'Resource not found');
  res.status(204).end();
});
