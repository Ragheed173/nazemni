import {
  calculateCourseStatus,
  calculateGradeStanding,
  calculatePriority,
  calculateWeeklyScore,
  detectFocusMode,
} from '@nazemni/shared';
import { prisma } from '../db.js';

const DAY = 86_400_000;
const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const daysBetween = (from: Date, to = new Date()) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY));

export async function getDailyPlan(now = new Date()) {
  const weekStart = new Date(startOfDay(now));
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 1) % 7));
  const [tasks, courses, lectures, assignments, projects, exams, reviews, weakTopics, settings] = await Promise.all([
    prisma.studyTask.findMany({ where: { status: { not: 'COMPLETED' } }, include: { course: true, lecture: true } }),
    prisma.course.findMany(),
    prisma.lecture.findMany({ where: { state: 'TAKEN_NOT_STUDIED' }, include: { course: true } }),
    prisma.assignment.findMany({ where: { status: { notIn: ['SUBMITTED', 'GRADED'] } }, include: { course: true } }),
    prisma.project.findMany({ where: { status: { notIn: ['COMPLETED', 'SUBMITTED'] } }, include: { course: true } }),
    prisma.exam.findMany({ where: { date: { gte: now }, preparationStatus: { not: 'COMPLETED' } }, include: { course: true } }),
    prisma.review.findMany({ where: { completedAt: null }, include: { course: true, lecture: true, weakTopic: true } }),
    prisma.weakTopic.findMany({ where: { resolved: false }, include: { course: true } }),
    prisma.appSettings.findUnique({ where: { id: 'settings' } }),
  ]);
  const coverageRows = await prisma.studyTask.groupBy({
    by: ['courseId'],
    where: { completedAt: { gte: weekStart } },
    _count: true,
  });
  const coverage = new Map(coverageRows.map((row) => [row.courseId, row._count]));
  const candidates: Array<ReturnType<typeof candidate>> = [];

  for (const task of tasks) {
    candidates.push(candidate(task.id, task.title, task.course, {
      kind: 'task', dueDate: task.dueAt, deferredCount: task.deferredCount,
      weeklyCoverageCount: coverage.get(task.courseId) ?? 0, baseImportance: task.priority === 'CRITICAL' ? 1 : task.priority === 'IMPORTANT' ? 0.65 : 0.25,
      estimatedEffort: task.estimatedEffort, entityId: task.id, retakeBonus: settings?.retakeBonus,
    }, now));
  }
  for (const lecture of lectures) {
    candidates.push(candidate('lecture-' + lecture.id, 'Study Lecture ' + lecture.number + ': ' + lecture.title, lecture.course, {
      kind: 'lecture', dueDate: lecture.lectureDate, backlogAgeDays: daysBetween(lecture.lectureDate, now),
      weeklyCoverageCount: coverage.get(lecture.courseId) ?? 0, baseImportance: 0.7, entityId: lecture.id, estimatedEffort: 30, retakeBonus: settings?.retakeBonus,
    }, now));
  }
  for (const assignment of assignments) {
    candidates.push(candidate('assignment-' + assignment.id, 'Work on ' + assignment.title, assignment.course, {
      kind: 'assignment', dueDate: assignment.internalDeadline ?? assignment.officialDeadline,
      assessmentWeight: assignment.weight, weeklyCoverageCount: coverage.get(assignment.courseId) ?? 0,
      baseImportance: 0.85, entityId: assignment.id, retakeBonus: settings?.retakeBonus,
    }, now));
  }
  for (const project of projects) {
    candidates.push(candidate('project-' + project.id, 'Advance ' + project.name, project.course, {
      kind: 'project', dueDate: project.internalDeadline ?? project.officialDeadline,
      assessmentWeight: project.weight, weeklyCoverageCount: coverage.get(project.courseId) ?? 0,
      baseImportance: 0.9, entityId: project.id, retakeBonus: settings?.retakeBonus,
    }, now));
  }
  for (const exam of exams) {
    candidates.push(candidate('exam-' + exam.id, 'Prepare for ' + exam.title, exam.course, {
      kind: 'exam', examDate: exam.date, assessmentWeight: exam.weight,
      weeklyCoverageCount: coverage.get(exam.courseId) ?? 0, baseImportance: 1, entityId: exam.id, retakeBonus: settings?.retakeBonus,
    }, now));
  }
  for (const review of reviews) {
    candidates.push(candidate('review-' + review.id, 'Review ' + (review.lecture?.title ?? review.weakTopic?.topic ?? review.course.nameEn), review.course, {
      kind: 'review', dueDate: review.scheduledAt, daysSinceReview: daysBetween(review.scheduledAt, now),
      weakTopicSeverity: review.weakTopic?.severity, weeklyCoverageCount: coverage.get(review.courseId) ?? 0,
      baseImportance: 0.65, entityId: review.id, estimatedEffort: 20, retakeBonus: settings?.retakeBonus,
    }, now));
  }
  for (const topic of weakTopics.filter((item) => item.severity === 'HIGH')) {
    candidates.push(candidate('weak-' + topic.id, 'Review weak topic: ' + topic.topic, topic.course, {
      kind: 'weakTopic', weakTopicSeverity: topic.severity, daysSinceReview: topic.lastReviewedAt ? daysBetween(topic.lastReviewedAt, now) : 14,
      weeklyCoverageCount: coverage.get(topic.courseId) ?? 0, baseImportance: 0.7, entityId: topic.id, estimatedEffort: 25, retakeBonus: settings?.retakeBonus,
    }, now));
  }
  const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, 8);
  return {
    generatedAt: now,
    groups: {
      CRITICAL: ranked.filter((item) => item.level === 'CRITICAL').slice(0, 3),
      IMPORTANT: ranked.filter((item) => item.level === 'IMPORTANT').slice(0, 4),
      OPTIONAL: ranked.filter((item) => item.level === 'OPTIONAL').slice(0, 2),
    },
    empty: ranked.length === 0,
  };
}

function candidate(
  id: string,
  title: string,
  course: { id: string; nameEn: string; nameAr: string; difficulty: number; retake: boolean; previousGrade: number | null },
  input: Record<string, unknown>,
  now: Date,
) {
  const result = calculatePriority({
    id, title, difficulty: course.difficulty, retake: course.retake,
    previousGrade: course.previousGrade, ...input,
  }, now);
  return { id, title, course: { id: course.id, nameEn: course.nameEn, nameAr: course.nameAr }, ...input, ...result };
}

export async function getBacklog(now = new Date()) {
  const [lectures, assignments, projects, reviews, tasks, topics] = await Promise.all([
    prisma.lecture.findMany({ where: { state: 'TAKEN_NOT_STUDIED' }, include: { course: true } }),
    prisma.assignment.findMany({ where: { officialDeadline: { lt: now }, status: { notIn: ['SUBMITTED', 'GRADED'] } }, include: { course: true } }),
    prisma.project.findMany({ where: { officialDeadline: { lt: now }, status: { notIn: ['COMPLETED', 'SUBMITTED'] } }, include: { course: true } }),
    prisma.review.findMany({ where: { scheduledAt: { lt: now }, completedAt: null }, include: { course: true } }),
    prisma.studyTask.findMany({ where: { deferredCount: { gte: 2 }, status: { not: 'COMPLETED' } }, include: { course: true } }),
    prisma.weakTopic.findMany({ where: { severity: 'HIGH', resolved: false }, include: { course: true } }),
  ]);
  const items = [
    ...lectures.map((x) => backlogItem('lecture', x.id, 'Lecture ' + x.number + ': ' + x.title, x.course, daysBetween(x.lectureDate, now), ['Not studied', x.course.difficulty >= 8 ? 'High-difficulty course' : 'Lecture is aging'])),
    ...assignments.map((x) => backlogItem('assignment', x.id, x.title, x.course, daysBetween(x.officialDeadline, now), ['Assignment is overdue', 'Submission not recorded'])),
    ...projects.map((x) => backlogItem('project', x.id, x.name, x.course, daysBetween(x.officialDeadline, now), ['Project deadline passed', 'Progress is ' + x.progress + '%'])),
    ...reviews.map((x) => backlogItem('review', x.id, 'Overdue review', x.course, daysBetween(x.scheduledAt, now), ['Review date passed'])),
    ...tasks.map((x) => backlogItem('task', x.id, x.title, x.course, x.deferredCount, ['Deferred ' + x.deferredCount + ' times'])),
    ...topics.map((x) => backlogItem('weakTopic', x.id, x.topic, x.course, 7, ['Unresolved high-severity weak topic'])),
  ];
  return items.sort((a, b) => b.risk - a.risk);
}

function backlogItem(kind: string, id: string, title: string, course: { id: string; nameEn: string; nameAr: string }, age: number, reasons: string[]) {
  return { kind, id, title, course, age, risk: Math.min(100, 35 + age * 7 + reasons.length * 8), reasons };
}

export async function getDashboard(now = new Date()) {
  const [plan, backlog, courses, assignments, projects, exams, schedule, settings] = await Promise.all([
    getDailyPlan(now),
    getBacklog(now),
    prisma.course.findMany({ include: { lectures: true, weakTopics: { where: { resolved: false } }, tasks: { where: { status: { not: 'COMPLETED' } } }, grades: true } }),
    prisma.assignment.findMany({ where: { status: { notIn: ['SUBMITTED', 'GRADED'] } }, include: { course: true }, orderBy: { officialDeadline: 'asc' }, take: 4 }),
    prisma.project.findMany({ where: { status: { notIn: ['COMPLETED', 'SUBMITTED'] } }, include: { course: true }, orderBy: { officialDeadline: 'asc' }, take: 4 }),
    prisma.exam.findMany({ where: { date: { gte: now } }, include: { course: true }, orderBy: { date: 'asc' }, take: 4 }),
    prisma.universitySchedule.findMany({ where: { dayOfWeek: now.getDay() }, include: { course: true }, orderBy: { startsAt: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 'settings' } }),
  ]);
  const courseStatuses = courses.map((course) => {
    const studied = course.lectures.filter((lecture) => lecture.state !== 'TAKEN_NOT_STUDIED').length;
    const standing = calculateGradeStanding(course.grades.map((grade) => ({ score: grade.score, maximum: grade.maximumScore, weight: grade.weight })));
    const status = calculateCourseStatus({
      backlogCount: course.lectures.length - studied,
      highWeakTopics: course.weakTopics.filter((topic) => topic.severity === 'HIGH').length,
      overdueAssessments: 0,
      lectureCompletion: course.lectures.length ? studied / course.lectures.length * 100 : 100,
      daysSinceStudy: course.lastStudyAt ? daysBetween(course.lastStudyAt, now) : 7,
      currentWeightedScore: standing.current,
      examWithinDays: null,
      weeklyCovered: Boolean(course.lastStudyAt && daysBetween(course.lastStudyAt, now) <= 7),
    });
    return { id: course.id, nameEn: course.nameEn, nameAr: course.nameAr, status, difficulty: course.difficulty };
  });
  let focus = detectFocusMode([
    ...exams.map((x) => ({ title: x.title, date: x.date, importance: 1 })),
    ...assignments.map((x) => ({ title: x.title, date: x.officialDeadline, importance: (x.weight ?? 10) / 20 })),
    ...projects.map((x) => ({ title: x.name, date: x.officialDeadline, importance: (x.weight ?? 20) / 25 })),
  ], now);
  if (settings?.focusModeManual === true) {
    focus = { active: true, reason: settings.focusModeReason ?? 'Enabled manually', event: undefined };
  } else if (settings?.focusModeManual === false) {
    focus = { active: false, reason: null, event: null };
  }
  return {
    plan,
    upcoming: [...assignments.map((x) => ({ kind: 'assignment', title: x.title, date: x.officialDeadline, course: x.course })),
      ...projects.map((x) => ({ kind: 'project', title: x.name, date: x.officialDeadline, course: x.course })),
      ...exams.map((x) => ({ kind: 'exam', title: x.title, date: x.date, course: x.course }))].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5),
    attention: courseStatuses.filter((course) => course.status !== 'ON_TRACK'),
    backlog: backlog.slice(0, 4),
    focus,
    schedule,
  };
}

export async function getWeeklyReview(now = new Date()) {
  const weekStart = new Date(startOfDay(now));
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 1) % 7));
  const [tasks, overdue, covered, reviews, courses, assignments, projects, exams, topics, grades] = await Promise.all([
    prisma.studyTask.findMany({ where: { createdAt: { gte: weekStart } } }),
    getBacklog(now),
    prisma.studyTask.groupBy({ by: ['courseId'], where: { completedAt: { gte: weekStart } }, _count: true }),
    prisma.review.findMany({ where: { scheduledAt: { gte: weekStart } } }),
    prisma.course.findMany(),
    prisma.assignment.findMany({ where: { status: { notIn: ['SUBMITTED', 'GRADED'] } } }),
    prisma.project.findMany({ where: { status: { notIn: ['COMPLETED', 'SUBMITTED'] } } }),
    prisma.exam.findMany({ where: { date: { gte: now } }, include: { course: true }, orderBy: { date: 'asc' }, take: 5 }),
    prisma.weakTopic.findMany({ where: { resolved: false }, include: { course: true } }),
    prisma.grade.findMany({ where: { createdAt: { gte: weekStart } }, include: { course: true } }),
  ]);
  const completed = tasks.filter((task) => task.status === 'COMPLETED').length;
  const deferred = tasks.filter((task) => task.status === 'DEFERRED').length;
  const reviewCompleted = reviews.filter((review) => review.completedAt).length;
  const metrics = calculateWeeklyScore({
    completedTasks: completed, plannedTasks: tasks.length, overdueItems: overdue.length,
    coursesCovered: covered.length, totalCourses: courses.length, reviewsCompleted: reviewCompleted,
    reviewsDue: reviews.length, deferredTasks: deferred,
    assignmentProgress: assignments.length ? assignments.reduce((sum, x) => sum + x.progress, 0) / assignments.length : 100,
    projectProgress: projects.length ? projects.reduce((sum, x) => sum + x.progress, 0) / projects.length : 100,
    examPreparation: exams.length ? exams.reduce((sum, x) => sum + (x.preparationStatus === 'COMPLETED' ? 100 : x.preparationStatus === 'READY' ? 85 : x.preparationStatus === 'IN_PROGRESS' ? 50 : 0), 0) / exams.length : 100,
  });
  return { weekStart, metrics, tasks: { completed, total: tasks.length, deferred }, backlog: overdue, coverage: courses.map((course) => ({ course, sessions: covered.find((x) => x.courseId === course.id)?._count ?? 0 })), reviews: { completed: reviewCompleted, total: reviews.length }, assignments, projects, exams, weakTopics: topics, grades };
}
