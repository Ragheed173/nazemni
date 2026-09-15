import { Router } from 'express';
import { calculateCourseStatus, calculateGradeStanding, reviewDelayDays } from '@nazemni/shared';
import { prisma } from '../db.js';
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
const ok = (data: unknown) => ({ ok: true, data });
const daysFromNow = (date: Date) => Math.ceil((date.getTime() - Date.now()) / 86_400_000);
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
  const data = await prisma.course.findMany({
    include: {
      _count: { select: { lectures: true, tasks: true, assignments: true, projects: true, exams: true, weakTopics: true } },
      lectures: { select: { state: true } },
      weakTopics: { select: { severity: true, resolved: true } },
      assignments: { select: { officialDeadline: true, status: true } },
      exams: { select: { date: true } },
      grades: true,
    },
    orderBy: [{ difficulty: 'desc' }, { nameEn: 'asc' }],
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
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      schedule: { orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }] },
      lectures: { orderBy: { number: 'asc' } },
      assignments: { orderBy: { officialDeadline: 'asc' } },
      projects: { include: { milestones: { orderBy: { order: 'asc' } } }, orderBy: { officialDeadline: 'asc' } },
      exams: { orderBy: { date: 'asc' } },
      grades: { orderBy: { date: 'desc' } },
      weakTopics: { orderBy: [{ resolved: 'asc' }, { severity: 'desc' }] },
      tasks: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
  res.json(ok({
    ...course,
    status: deriveStatus(course),
    gradeStanding: calculateGradeStanding(course.grades.map((x) => ({ score: x.score, maximum: x.maximumScore, weight: x.weight }))),
  }));
});

entityRouter.get('/schedule', async (_req, res) => {
  res.json(ok(await prisma.universitySchedule.findMany({ include: { course: true }, orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }] })));
});

entityRouter.get('/lectures', async (req, res) => {
  res.json(ok(await prisma.lecture.findMany({
    where: req.query.courseId ? { courseId: String(req.query.courseId) } : undefined,
    include: { course: true },
    orderBy: [{ lectureDate: 'desc' }, { number: 'desc' }],
  })));
});

entityRouter.post('/lectures', async (req, res) => {
  const input = lectureInput.parse(req.body);
  const lecture = await prisma.lecture.create({ data: input, include: { course: true } });
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
  const input = lectureInput.partial().parse(req.body);
  const data = {
    ...input,
    studiedAt: input.state && input.state !== 'TAKEN_NOT_STUDIED' ? new Date() : undefined,
    masteredAt: input.state === 'MASTERED' ? new Date() : undefined,
  };
  const lecture = await prisma.lecture.update({ where: { id: req.params.id }, data, include: { course: true } });
  if (input.state && input.state !== 'TAKEN_NOT_STUDIED') {
    await prisma.studyTask.updateMany({ where: { lectureId: lecture.id, status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED', completedAt: new Date() } });
    if (input.understandingScore) {
      const delay = reviewDelayDays(lecture.course.difficulty, input.understandingScore, input.needsReview);
      const settings = await prisma.appSettings.findUnique({ where: { id: 'settings' } });
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
    await prisma.course.update({ where: { id: lecture.courseId }, data: { lastStudyAt: new Date() } });
  }
  res.json(ok(lecture));
});

entityRouter.delete('/lectures/:id', async (req, res) => {
  await prisma.lecture.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

entityRouter.get('/tasks', async (req, res) => {
  res.json(ok(await prisma.studyTask.findMany({
    where: {
      ...(req.query.status ? { status: String(req.query.status) as never } : {}),
      ...(req.query.courseId ? { courseId: String(req.query.courseId) } : {}),
    },
    include: { course: true, lecture: true },
    orderBy: [{ status: 'asc' }, { priorityScore: 'desc' }, { dueAt: 'asc' }],
  })));
});

entityRouter.post('/tasks', async (req, res) => {
  const input = taskInput.parse(req.body);
  const data = await prisma.studyTask.create({ data: input, include: { course: true } });
  res.status(201).json(ok(data));
});

entityRouter.patch('/tasks/:id', async (req, res) => {
  const input = taskInput.partial().parse(req.body);
  const existing = await prisma.studyTask.findUniqueOrThrow({ where: { id: req.params.id } });
  const data = await prisma.studyTask.update({
    where: { id: req.params.id },
    data: {
      ...input,
      completedAt: input.status === 'COMPLETED' ? new Date() : input.status ? null : undefined,
      deferredCount: input.status === 'DEFERRED' && existing.status !== 'DEFERRED' ? { increment: 1 } : undefined,
    },
    include: { course: true },
  });
  if (input.status === 'COMPLETED') await prisma.course.update({ where: { id: data.courseId }, data: { lastStudyAt: new Date() } });
  res.json(ok(data));
});

entityRouter.delete('/tasks/:id', async (req, res) => {
  await prisma.studyTask.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

entityRouter.get('/assignments', async (req, res) => {
  res.json(ok(await prisma.assignment.findMany({ where: req.query.courseId ? { courseId: String(req.query.courseId) } : undefined, include: { course: true }, orderBy: { officialDeadline: 'asc' } })));
});

entityRouter.post('/assignments', async (req, res) => {
  const input = assignmentInput.parse(req.body);
  const course = await prisma.course.findUniqueOrThrow({ where: { id: input.courseId } });
  const bufferDays = Math.min(4, Math.max(1, Math.ceil((input.weight ?? 10) / 10) + (course.difficulty >= 8 ? 1 : 0)));
  const data = await prisma.assignment.create({
    data: {
      ...input,
      internalDeadline: input.internalDeadline ?? new Date(input.officialDeadline.getTime() - bufferDays * 86_400_000),
    },
    include: { course: true },
  });
  res.status(201).json(ok(data));
});

entityRouter.patch('/assignments/:id', async (req, res) => {
  const input = assignmentInput.partial().parse(req.body);
  res.json(ok(await prisma.assignment.update({ where: { id: req.params.id }, data: input, include: { course: true } })));
});

entityRouter.delete('/assignments/:id', async (req, res) => {
  await prisma.assignment.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

entityRouter.get('/projects', async (req, res) => {
  res.json(ok(await prisma.project.findMany({ where: req.query.courseId ? { courseId: String(req.query.courseId) } : undefined, include: { course: true, milestones: { orderBy: { order: 'asc' } } }, orderBy: { officialDeadline: 'asc' } })));
});

entityRouter.post('/projects', async (req, res) => {
  const { addDefaultMilestones, ...input } = projectInput.parse(req.body);
  const course = await prisma.course.findUniqueOrThrow({ where: { id: input.courseId } });
  const bufferDays = Math.min(7, Math.max(3, Math.ceil((input.weight ?? 20) / 8) + (course.difficulty >= 8 ? 1 : 0)));
  const defaultMilestones = ['Understand Requirements', 'Setup / Research', 'Implementation', 'Testing', 'Final Polish', 'Submission'];
  const data = await prisma.project.create({
    data: {
      ...input,
      internalDeadline: input.internalDeadline ?? new Date(input.officialDeadline.getTime() - bufferDays * 86_400_000),
      milestones: addDefaultMilestones ? { create: defaultMilestones.map((title, order) => ({ title, order })) } : undefined,
    },
    include: { course: true, milestones: { orderBy: { order: 'asc' } } },
  });
  res.status(201).json(ok(data));
});

entityRouter.patch('/projects/:id', async (req, res) => {
  const { addDefaultMilestones: _ignored, ...input } = projectInput.partial().parse(req.body);
  res.json(ok(await prisma.project.update({ where: { id: req.params.id }, data: input, include: { course: true, milestones: { orderBy: { order: 'asc' } } } })));
});

entityRouter.patch('/milestones/:id', async (req, res) => {
  const input = req.body as { status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; title?: string; notes?: string; dueAt?: string | null };
  const data = await prisma.projectMilestone.update({
    where: { id: req.params.id },
    data: { ...input, dueAt: input.dueAt ? new Date(input.dueAt) : input.dueAt, completedAt: input.status === 'COMPLETED' ? new Date() : input.status ? null : undefined },
  });
  const all = await prisma.projectMilestone.findMany({ where: { projectId: data.projectId } });
  await prisma.project.update({ where: { id: data.projectId }, data: { progress: Math.round(all.filter((x) => x.status === 'COMPLETED').length / all.length * 100) } });
  res.json(ok(data));
});

entityRouter.delete('/projects/:id', async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

entityRouter.get('/exams', async (req, res) => {
  res.json(ok(await prisma.exam.findMany({ where: req.query.courseId ? { courseId: String(req.query.courseId) } : undefined, include: { course: true }, orderBy: { date: 'asc' } })));
});

entityRouter.post('/exams', async (req, res) => {
  const input = examInput.parse(req.body);
  const course = await prisma.course.findUniqueOrThrow({ where: { id: input.courseId } });
  const leadDays = course.difficulty >= 8 ? 8 : 6;
  const data = await prisma.exam.create({
    data: { ...input, preparationStartAt: input.preparationStartAt ?? new Date(input.date.getTime() - leadDays * 86_400_000) },
    include: { course: true },
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
  const input = examInput.partial().parse(req.body);
  res.json(ok(await prisma.exam.update({ where: { id: req.params.id }, data: input, include: { course: true } })));
});

entityRouter.delete('/exams/:id', async (req, res) => {
  await prisma.exam.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

entityRouter.get('/grades', async (req, res) => {
  const grades = await prisma.grade.findMany({ where: req.query.courseId ? { courseId: String(req.query.courseId) } : undefined, include: { course: true }, orderBy: { date: 'desc' } });
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
  const input = gradeInput.parse(req.body);
  if (input.score > input.maximumScore) {
    res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Score cannot exceed maximum score' } });
    return;
  }
  const data = await prisma.grade.create({ data: input, include: { course: true } });
  res.status(201).json(ok(data));
});

entityRouter.patch('/grades/:id', async (req, res) => {
  const input = gradeInput.partial().parse(req.body);
  res.json(ok(await prisma.grade.update({ where: { id: req.params.id }, data: input, include: { course: true } })));
});

entityRouter.delete('/grades/:id', async (req, res) => {
  await prisma.grade.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

entityRouter.get('/weak-topics', async (req, res) => {
  res.json(ok(await prisma.weakTopic.findMany({ where: req.query.courseId ? { courseId: String(req.query.courseId) } : undefined, include: { course: true }, orderBy: [{ resolved: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }] })));
});

entityRouter.post('/weak-topics', async (req, res) => {
  const input = weakTopicInput.parse(req.body);
  const topic = await prisma.weakTopic.create({ data: input, include: { course: true } });
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
  const input = weakTopicInput.partial().parse(req.body);
  const resolved = typeof req.body.resolved === 'boolean' ? req.body.resolved : undefined;
  const data = await prisma.weakTopic.update({
    where: { id: req.params.id },
    data: { ...input, resolved, resolvedAt: resolved === true ? new Date() : resolved === false ? null : undefined },
    include: { course: true },
  });
  res.json(ok(data));
});

entityRouter.delete('/weak-topics/:id', async (req, res) => {
  await prisma.weakTopic.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
