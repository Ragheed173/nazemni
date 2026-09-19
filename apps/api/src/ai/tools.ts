import { createHash } from 'node:crypto';
import { calculateGradeStanding, reviewDelayDays } from '@nazemni/shared';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { getBacklog, getDailyPlan, getWeeklyReview } from '../services/study.js';
import type { AIToolDefinition } from './provider.js';

const courseSelect = { id: true, difficulty: true, credits: true, retake: true, targetGrade: true, catalog: { select: { courseCode: true, nameAr: true, nameEn: true } } } as const;
const DAY = 86_400_000;

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string' };
const nullableString = { type: ['string', 'null'] };
const number = { type: 'number' };
const boolean = { type: 'boolean' };

export const aiToolDefinitions: AIToolDefinition[] = [
  { name: 'getStudentState', description: 'Get a compact overview of the authenticated student academic state.', parameters: objectSchema({}) },
  { name: 'getCurrentSemester', description: 'Get the authenticated student current semester.', parameters: objectSchema({}) },
  { name: 'getCourses', description: 'List the authenticated student active courses.', parameters: objectSchema({}) },
  { name: 'findCourse', description: 'Find active owned courses by name or code.', parameters: objectSchema({ query: string }, ['query']) },
  { name: 'getCourseDetails', description: 'Get details for one owned semester course.', parameters: objectSchema({ courseId: string }, ['courseId']) },
  { name: 'getUpcomingDeadlines', description: 'List upcoming assignments and project deadlines.', parameters: objectSchema({ days: number }) },
  { name: 'getUpcomingExams', description: 'List upcoming exams.', parameters: objectSchema({ days: number }) },
  { name: 'getBacklog', description: 'Get backlog from Nazemni deterministic planning logic.', parameters: objectSchema({}) },
  { name: 'getDailyPlan', description: 'Get today plan and deterministic priority scores/reasons.', parameters: objectSchema({}) },
  { name: 'getWeeklyReview', description: 'Get the current deterministic weekly review.', parameters: objectSchema({}) },
  { name: 'getGrades', description: 'Get owned grades and deterministic grade standing. Optionally filter by course.', parameters: objectSchema({ courseId: nullableString }) },
  { name: 'getWeakTopics', description: 'Get unresolved owned weak topics.', parameters: objectSchema({ courseId: nullableString }) },
  { name: 'getLectureProgress', description: 'Get owned lecture progress. Optionally filter by course.', parameters: objectSchema({ courseId: nullableString }) },
  { name: 'createStudyTask', description: 'Create a low-risk study task for an owned course.', parameters: objectSchema({ courseId: string, title: string, description: nullableString, type: string, priority: string, dueAt: nullableString, estimatedEffort: { type: ['number', 'null'] } }, ['courseId', 'title', 'type']) },
  { name: 'updateStudyTask', description: 'Update an owned study task.', parameters: objectSchema({ taskId: string, title: nullableString, description: nullableString, status: nullableString, priority: nullableString, dueAt: nullableString, estimatedEffort: { type: ['number', 'null'] } }, ['taskId']) },
  { name: 'completeStudyTask', description: 'Mark an owned study task completed.', parameters: objectSchema({ taskId: string }, ['taskId']) },
  { name: 'updateLectureProgress', description: 'Update progress for an owned lecture.', parameters: objectSchema({ lectureId: string, state: string, understandingScore: { type: ['number', 'null'] }, needsReview: boolean, notes: nullableString }, ['lectureId', 'state']) },
  { name: 'createAssignment', description: 'Create an assignment for an owned course.', parameters: objectSchema({ courseId: string, title: string, officialDeadline: string, description: nullableString, weight: { type: ['number', 'null'] } }, ['courseId', 'title', 'officialDeadline']) },
  { name: 'updateAssignment', description: 'Update an owned assignment.', parameters: objectSchema({ assignmentId: string, title: nullableString, officialDeadline: nullableString, progress: { type: ['number', 'null'] }, status: nullableString }, ['assignmentId']) },
  { name: 'createExam', description: 'Create an exam for an owned course after resolving an absolute date.', parameters: objectSchema({ courseId: string, type: string, title: string, date: string, weight: { type: ['number', 'null'] }, coveredTopics: { type: 'array', items: string } }, ['courseId', 'type', 'title', 'date']) },
  { name: 'updateExam', description: 'Update an owned exam. Changing its date requires explicit user confirmation.', parameters: objectSchema({ examId: string, title: nullableString, date: nullableString, preparationStatus: nullableString, confidenceLevel: { type: ['number', 'null'] } }, ['examId']) },
  { name: 'createProject', description: 'Create a project for an owned course.', parameters: objectSchema({ courseId: string, name: string, officialDeadline: string, description: nullableString, weight: { type: ['number', 'null'] } }, ['courseId', 'name', 'officialDeadline']) },
  { name: 'createProjectMilestone', description: 'Create a milestone on an owned project.', parameters: objectSchema({ projectId: string, title: string, dueAt: nullableString }, ['projectId', 'title']) },
  { name: 'recordGrade', description: 'Record a new grade for an owned course. Never invent weight.', parameters: objectSchema({ courseId: string, assessmentType: string, title: string, score: number, maximumScore: number, weight: { type: ['number', 'null'] }, date: string }, ['courseId', 'assessmentType', 'title', 'score', 'maximumScore', 'date']) },
  { name: 'addWeakTopic', description: 'Add a weak topic for an owned course and schedule its review.', parameters: objectSchema({ courseId: string, topic: string, severity: string, description: nullableString }, ['courseId', 'topic']) },
  { name: 'resolveWeakTopic', description: 'Resolve an owned weak topic.', parameters: objectSchema({ weakTopicId: string }, ['weakTopicId']) },
];

const noArgs = z.object({}).strict();
const optionalCourse = z.object({ courseId: z.string().min(1).nullable().optional() }).strict();
const taskType = z.enum(['LECTURE', 'REVIEW', 'ASSIGNMENT', 'PROJECT', 'EXAM_PREP', 'PRACTICE', 'OTHER']);
const priority = z.enum(['CRITICAL', 'IMPORTANT', 'OPTIONAL']);
const workStatus = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'READY_TO_SUBMIT', 'SUBMITTED', 'GRADED']);

const schemas: Record<string, z.ZodTypeAny> = {
  getStudentState: noArgs, getCurrentSemester: noArgs, getCourses: noArgs, getBacklog: noArgs, getDailyPlan: noArgs, getWeeklyReview: noArgs,
  findCourse: z.object({ query: z.string().trim().min(1).max(180) }).strict(),
  getCourseDetails: z.object({ courseId: z.string().min(1) }).strict(),
  getUpcomingDeadlines: z.object({ days: z.number().int().min(1).max(180).default(30) }).strict(),
  getUpcomingExams: z.object({ days: z.number().int().min(1).max(365).default(60) }).strict(),
  getGrades: optionalCourse, getWeakTopics: optionalCourse, getLectureProgress: optionalCourse,
  createStudyTask: z.object({ courseId: z.string(), title: z.string().min(2).max(180), description: z.string().max(4000).nullable().optional(), type: taskType, priority: priority.default('IMPORTANT'), dueAt: z.string().nullable().optional(), estimatedEffort: z.number().int().min(1).max(600).nullable().optional() }).strict(),
  updateStudyTask: z.object({ taskId: z.string(), title: z.string().min(2).max(180).nullable().optional(), description: z.string().max(4000).nullable().optional(), status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED']).nullable().optional(), priority: priority.nullable().optional(), dueAt: z.string().nullable().optional(), estimatedEffort: z.number().int().min(1).max(600).nullable().optional() }).strict(),
  completeStudyTask: z.object({ taskId: z.string() }).strict(),
  updateLectureProgress: z.object({ lectureId: z.string(), state: z.enum(['TAKEN_NOT_STUDIED', 'STUDIED', 'NEEDS_REVIEW', 'MASTERED']), understandingScore: z.number().int().min(1).max(10).nullable().optional(), needsReview: z.boolean().default(false), notes: z.string().max(4000).nullable().optional() }).strict(),
  createAssignment: z.object({ courseId: z.string(), title: z.string().min(2).max(180), officialDeadline: z.string(), description: z.string().max(4000).nullable().optional(), weight: z.number().min(0).max(100).nullable().optional() }).strict(),
  updateAssignment: z.object({ assignmentId: z.string(), title: z.string().min(2).max(180).nullable().optional(), officialDeadline: z.string().nullable().optional(), progress: z.number().int().min(0).max(100).nullable().optional(), status: workStatus.nullable().optional() }).strict(),
  createExam: z.object({ courseId: z.string(), type: z.enum(['QUIZ', 'MIDTERM', 'FINAL']), title: z.string().min(2).max(180), date: z.string(), weight: z.number().min(0).max(100).nullable().optional(), coveredTopics: z.array(z.string().min(1).max(180)).max(50).default([]) }).strict(),
  updateExam: z.object({ examId: z.string(), title: z.string().min(2).max(180).nullable().optional(), date: z.string().nullable().optional(), preparationStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED']).nullable().optional(), confidenceLevel: z.number().int().min(1).max(10).nullable().optional() }).strict(),
  createProject: z.object({ courseId: z.string(), name: z.string().min(2).max(180), officialDeadline: z.string(), description: z.string().max(4000).nullable().optional(), weight: z.number().min(0).max(100).nullable().optional() }).strict(),
  createProjectMilestone: z.object({ projectId: z.string(), title: z.string().min(2).max(180), dueAt: z.string().nullable().optional() }).strict(),
  recordGrade: z.object({ courseId: z.string(), assessmentType: z.enum(['QUIZ', 'ASSIGNMENT', 'PROJECT', 'MIDTERM', 'FINAL', 'PARTICIPATION', 'OTHER']), title: z.string().min(2).max(180), score: z.number().min(0), maximumScore: z.number().positive(), weight: z.number().min(0).max(100).nullable().optional(), date: z.string() }).strict(),
  addWeakTopic: z.object({ courseId: z.string(), topic: z.string().min(2).max(180), severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'), description: z.string().max(4000).nullable().optional() }).strict(),
  resolveWeakTopic: z.object({ weakTopicId: z.string() }).strict(),
};

const definitionsByName = new Map(aiToolDefinitions.map((tool) => [tool.name, tool]));
const tools = (...names: string[]) => names.map((name) => definitionsByName.get(name)).filter((tool): tool is AIToolDefinition => Boolean(tool));

export function selectAIToolDefinitions(message: string, pendingToolName?: string) {
  if (pendingToolName) return tools(pendingToolName);
  const value = message.toLowerCase();
  if (/(شو|ماذا|what).*(أدرس|ادرس|study).*(اليوم|today)|خطة اليوم|daily plan/u.test(value)) return tools('getDailyPlan');
  if (/متراكم|التراكم|backlog|overdue/u.test(value)) return tools('getBacklog');
  if (/وضعي بالمواد|وضعي الدراسي|حالتي الدراسية|overall.*(course|study)|how am i doing/u.test(value)) return tools('getStudentState');
  if (/علام|درجة|جبت|score|grade|quiz|كويز/u.test(value)) return tools('findCourse', 'getGrades', 'recordGrade');
  if (/محاضر|lecture|خلصت|أنهيت|انهيت|studied/u.test(value)) return tools('findCourse', 'getLectureProgress', 'updateLectureProgress');
  if (/امتحان|اختبار|exam|midterm|final/u.test(value)) return tools('findCourse', 'getUpcomingExams', 'createExam', 'updateExam');
  if (/واجب|assignment/u.test(value)) return tools('findCourse', 'getUpcomingDeadlines', 'createAssignment', 'updateAssignment');
  if (/مشروع|project/u.test(value)) return tools('findCourse', 'getUpcomingDeadlines', 'createProject', 'createProjectMilestone');
  if (/ضعف|weak topic/u.test(value)) return tools('findCourse', 'getWeakTopics', 'addWeakTopic', 'resolveWeakTopic');
  if (/أسبوع|اسبوع|weekly/u.test(value)) return tools('getWeeklyReview');
  if (/مهمة|task/u.test(value)) return tools('findCourse', 'getCourses', 'createStudyTask', 'updateStudyTask', 'completeStudyTask');
  if (/مادة|مساق|course|شبكات|network|بيانات|data|إحصاء|احصاء|statistic/u.test(value)) return tools('findCourse', 'getCourseDetails');
  return aiToolDefinitions;
}

export type PendingConfirmation = { fingerprint: string; toolName: string; args: unknown; summary: string };
export type ToolExecutionContext = { userId: string; timezone: string; approvedFingerprint?: string };

const fingerprint = (toolName: string, args: unknown) => createHash('sha256').update(toolName + ':' + JSON.stringify(args)).digest('hex');
const confirmation = (toolName: string, args: unknown, summary: string) => ({
  ok: false,
  requiresConfirmation: true,
  confirmation: { fingerprint: fingerprint(toolName, args), toolName, args, summary } satisfies PendingConfirmation,
});

async function ownedCourse(userId: string, courseId: string) {
  const course = await prisma.semesterCourse.findFirst({ where: { id: courseId, semester: { userId } }, select: courseSelect });
  if (!course) throw new AppError(404, 'Resource not found');
  return course;
}

async function assessmentAllowed(userId: string, courseId: string, type: 'QUIZ' | 'ASSIGNMENT' | 'PROJECT' | 'MIDTERM' | 'FINAL' | 'PARTICIPATION' | 'OTHER') {
  await ownedCourse(userId, courseId);
  const configured = await prisma.assessmentComponent.count({ where: { semesterCourseId: courseId, enabled: true } });
  if (configured && !(await prisma.assessmentComponent.count({ where: { semesterCourseId: courseId, type, enabled: true } }))) throw new AppError(400, 'Assessment type is not enabled for this course');
}

const localParts = (date: Date, timezone: string) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
function localNoon(year: number, month: number, day: number, timezone: string) {
  const trial = new Date(Date.UTC(year, month - 1, day, 12));
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(trial);
  const p = Object.fromEntries(parts.filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  const offset = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!) - trial.getTime();
  return new Date(Date.UTC(year, month - 1, day, 12) - offset);
}

export function resolveUserDate(value: string, timezone: string, now = new Date()) {
  const normalized = value.trim().toLowerCase();
  const today = localParts(now, timezone);
  const base = localNoon(Number(today.year), Number(today.month), Number(today.day), timezone);
  if (['today', 'اليوم'].includes(normalized)) return base;
  if (['tomorrow', 'بكرا', 'غدا', 'غداً'].includes(normalized)) return new Date(base.getTime() + DAY);
  const weekdayNames: Record<string, number> = { sunday: 0, sundaynext: 0, الأحد: 0, الاحد: 0, monday: 1, الاثنين: 1, tuesday: 2, الثلاثاء: 2, wednesday: 3, الأربعاء: 3, الاربعاء: 3, thursday: 4, الخميس: 4, friday: 5, الجمعة: 5, saturday: 6, السبت: 6 };
  const weekday = Object.entries(weekdayNames).find(([name]) => normalized.replace(/\s+/g, '').includes(name))?.[1];
  if (weekday !== undefined) {
    const current = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now);
    const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(current);
    let delta = (weekday - currentDay + 7) % 7;
    if (delta === 0 || normalized.includes('next') || normalized.includes('الجاي') || normalized.includes('القادم')) delta += 7;
    return new Date(base.getTime() + delta * DAY);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[tT](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:[zZ]|[+-]\d{2}:?\d{2})?)?$/.exec(value);
  if (!match) throw new AppError(400, 'Date is ambiguous; provide YYYY-MM-DD or a supported relative date');
  if (match[4]) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new AppError(400, 'Invalid date');
    return parsed;
  }
  return localNoon(Number(match[1]), Number(match[2]), Number(match[3]), timezone);
}

const courseDto = (course: Awaited<ReturnType<typeof ownedCourse>>) => ({ id: course.id, code: course.catalog.courseCode, nameAr: course.catalog.nameAr, nameEn: course.catalog.nameEn, credits: course.credits, difficulty: course.difficulty, retake: course.retake, targetGrade: course.targetGrade });

const normalizedCourseQuery = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function compactDailyPlan(plan: Awaited<ReturnType<typeof getDailyPlan>>) {
  const items = [...plan.groups.CRITICAL, ...plan.groups.IMPORTANT, ...plan.groups.OPTIONAL].map((item) => {
    const details = item as typeof item & { kind?: unknown; dueDate?: unknown; examDate?: unknown; estimatedEffort?: unknown };
    return {
      id: item.id,
      course: item.course,
      title: item.title,
      type: details.kind,
      priority: item.level,
      score: item.score,
      reasons: item.reasons,
      deadline: details.dueDate ?? details.examDate ?? null,
      minutes: details.estimatedEffort ?? null,
    };
  });
  return { empty: plan.empty, items };
}

export function compactBacklog(backlog: Awaited<ReturnType<typeof getBacklog>>) {
  return {
    count: backlog.length,
    items: backlog.slice(0, 20).map((item) => ({
      id: item.id,
      course: { id: item.course.id, code: item.course.code, nameAr: item.course.nameAr, nameEn: item.course.nameEn },
      title: item.title,
      type: item.kind,
      overdueDays: item.age,
      deadline: item.deadline,
      priority: item.risk >= 65 ? 'CRITICAL' : item.risk >= 38 ? 'IMPORTANT' : 'OPTIONAL',
    })),
  };
}

export async function getStudentAIContext(userId: string) {
  const soon = new Date(Date.now() + 7 * DAY);
  const [semester, courses, exams, assignments, projects, topics, backlog] = await Promise.all([
    prisma.semester.findFirst({ where: { userId, isCurrent: true }, select: { id: true, name: true } }),
    prisma.semesterCourse.findMany({ where: { semester: { userId, isCurrent: true }, enrollmentStatus: 'ACTIVE' }, select: courseSelect }),
    prisma.exam.count({ where: { date: { gte: new Date() }, course: { semester: { userId }, enrollmentStatus: 'ACTIVE' } } }),
    prisma.assignment.count({ where: { officialDeadline: { lte: soon }, status: { notIn: ['SUBMITTED', 'GRADED'] }, course: { semester: { userId }, enrollmentStatus: 'ACTIVE' } } }),
    prisma.project.count({ where: { officialDeadline: { lte: soon }, status: { notIn: ['COMPLETED', 'SUBMITTED'] }, course: { semester: { userId }, enrollmentStatus: 'ACTIVE' } } }),
    prisma.weakTopic.count({ where: { resolved: false, course: { semester: { userId }, enrollmentStatus: 'ACTIVE' } } }),
    getBacklog(userId),
  ]);
  return { semester, activeCourseCount: courses.length, courses: courses.map(courseDto), urgentDeadlineCount: assignments + projects, upcomingExamCount: exams, backlogCount: backlog.length, weakTopicCount: topics };
}

export async function executeAITool(name: string, rawArgs: unknown, context: ToolExecutionContext): Promise<unknown> {
  const schema = schemas[name];
  if (!schema) throw new AppError(400, 'Unknown AI tool');
  // Values are validated by the strict per-tool Zod schema immediately above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = schema.parse(rawArgs) as Record<string, any>;
  const { userId, timezone } = context;
  const ownedFilter = { semester: { userId, isCurrent: true }, enrollmentStatus: 'ACTIVE' as const };

  switch (name) {
    case 'getStudentState': return getStudentAIContext(userId);
    case 'getCurrentSemester': return prisma.semester.findFirst({ where: { userId, isCurrent: true }, select: { id: true, name: true, academicYear: true, term: true } });
    case 'getCourses': return (await prisma.semesterCourse.findMany({ where: ownedFilter, select: courseSelect })).map(courseDto);
    case 'findCourse': {
      const query = normalizedCourseQuery(args.query);
      if (!query) return { matches: [] };
      const courses = (await prisma.semesterCourse.findMany({ where: ownedFilter, select: courseSelect })).map(courseDto);
      const ranked = courses.map((course) => {
        const values = [course.code, course.nameAr, course.nameEn].map(normalizedCourseQuery);
        const score = values.some((value) => value === query) ? 3 : values.some((value) => value.includes(query) || query.includes(value)) ? 2 : query.split(' ').some((term) => term.length > 2 && values.some((value) => value.includes(term))) ? 1 : 0;
        return { course, score };
      }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map((item) => item.course);
      return { matches: ranked };
    }
    case 'getCourseDetails': {
      await ownedCourse(userId, args.courseId);
      const course = await prisma.semesterCourse.findFirst({ where: { id: args.courseId, semester: { userId } }, select: { ...courseSelect, status: true, lastStudyAt: true, assessmentComponents: { select: { type: true, name: true, weight: true, enabled: true } }, _count: { select: { lectures: true, tasks: true, assignments: true, projects: true, exams: true, weakTopics: true } } } });
      if (!course) throw new AppError(404, 'Resource not found');
      return { ...courseDto(course), status: course.status, lastStudyAt: course.lastStudyAt, assessments: course.assessmentComponents.filter((item) => item.enabled).map(({ type, name, weight }) => ({ type, name, weight })), counts: course._count };
    }
    case 'getUpcomingDeadlines': {
      const until = new Date(Date.now() + (args.days ?? 30) * DAY);
      const [assignments, projects] = await Promise.all([
        prisma.assignment.findMany({ where: { officialDeadline: { gte: new Date(), lte: until }, course: ownedFilter }, select: { id: true, title: true, officialDeadline: true, status: true, courseId: true }, orderBy: { officialDeadline: 'asc' }, take: 30 }),
        prisma.project.findMany({ where: { officialDeadline: { gte: new Date(), lte: until }, course: ownedFilter }, select: { id: true, name: true, officialDeadline: true, status: true, progress: true, courseId: true }, orderBy: { officialDeadline: 'asc' }, take: 30 }),
      ]); return { assignments, projects };
    }
    case 'getUpcomingExams': return prisma.exam.findMany({ where: { date: { gte: new Date(), lte: new Date(Date.now() + (args.days ?? 60) * DAY) }, course: ownedFilter }, select: { id: true, courseId: true, type: true, title: true, date: true, preparationStatus: true, confidenceLevel: true, weight: true }, orderBy: { date: 'asc' }, take: 30 });
    case 'getBacklog': return compactBacklog(await getBacklog(userId));
    case 'getDailyPlan': return compactDailyPlan(await getDailyPlan(userId));
    case 'getWeeklyReview': {
      const review = await getWeeklyReview(userId);
      return { weekStart: review.weekStart, metrics: review.metrics, tasks: review.tasks, backlogCount: review.backlog.length, coverage: review.coverage.map((item) => ({ course: { id: item.course.id, code: item.course.code, nameAr: item.course.nameAr, nameEn: item.course.nameEn }, sessions: item.sessions })), reviews: review.reviews, activeAssignments: review.assignments.length, activeProjects: review.projects.length, upcomingExams: review.exams.length, weakTopics: review.weakTopics.length, newGrades: review.grades.length };
    }
    case 'getGrades': {
      if (args.courseId) await ownedCourse(userId, args.courseId);
      const grades = await prisma.grade.findMany({ where: { ...(args.courseId ? { courseId: args.courseId } : {}), course: ownedFilter }, select: { id: true, courseId: true, assessmentType: true, title: true, score: true, maximumScore: true, weight: true, date: true }, orderBy: { date: 'desc' }, take: 30 });
      const grouped = grades.reduce<Map<string, typeof grades>>((result, item) => { const items = result.get(item.courseId) ?? []; items.push(item); result.set(item.courseId, items); return result; }, new Map());
      return { grades, standing: [...grouped].map(([courseId, items]) => ({ courseId, ...calculateGradeStanding(items.map((x) => ({ score: x.score, maximum: x.maximumScore, weight: x.weight }))) })) };
    }
    case 'getWeakTopics': if (args.courseId) await ownedCourse(userId, args.courseId); return prisma.weakTopic.findMany({ where: { ...(args.courseId ? { courseId: args.courseId } : {}), resolved: false, course: ownedFilter }, select: { id: true, courseId: true, topic: true, severity: true, lastReviewedAt: true, reviewCount: true }, take: 30 });
    case 'getLectureProgress': if (args.courseId) await ownedCourse(userId, args.courseId); return prisma.lecture.findMany({ where: { ...(args.courseId ? { courseId: args.courseId } : {}), course: ownedFilter }, select: { id: true, courseId: true, number: true, title: true, lectureDate: true, state: true, understandingScore: true, needsReview: true }, orderBy: [{ courseId: 'asc' }, { number: 'asc' }], take: 50 });
    case 'createStudyTask': {
      await ownedCourse(userId, args.courseId);
      const task = await prisma.studyTask.create({ data: { courseId: args.courseId, title: args.title, description: args.description, type: args.type, priority: args.priority, dueAt: args.dueAt ? resolveUserDate(args.dueAt, timezone) : null, estimatedEffort: args.estimatedEffort, source: 'ai' }, select: { id: true, courseId: true, title: true, type: true, priority: true, status: true, dueAt: true } });
      return { ok: true, changed: task };
    }
    case 'updateStudyTask': {
      const existing = await prisma.studyTask.findFirst({ where: { id: args.taskId, course: { semester: { userId } } } }); if (!existing) throw new AppError(404, 'Resource not found');
      const data = await prisma.studyTask.update({ where: { id: existing.id }, data: { title: args.title ?? undefined, description: args.description, status: args.status ?? undefined, priority: args.priority ?? undefined, dueAt: args.dueAt === null ? null : args.dueAt ? resolveUserDate(args.dueAt, timezone) : undefined, estimatedEffort: args.estimatedEffort, completedAt: args.status === 'COMPLETED' ? new Date() : args.status ? null : undefined, deferredCount: args.status === 'DEFERRED' && existing.status !== 'DEFERRED' ? { increment: 1 } : undefined }, select: { id: true, courseId: true, title: true, status: true, dueAt: true } });
      return { ok: true, changed: data };
    }
    case 'completeStudyTask': {
      const existing = await prisma.studyTask.findFirst({ where: { id: args.taskId, course: { semester: { userId } } } }); if (!existing) throw new AppError(404, 'Resource not found');
      const data = await prisma.studyTask.update({ where: { id: existing.id }, data: { status: 'COMPLETED', completedAt: new Date() }, select: { id: true, courseId: true, title: true, status: true, completedAt: true } });
      await prisma.semesterCourse.update({ where: { id: data.courseId }, data: { lastStudyAt: new Date() } }); return { ok: true, changed: data };
    }
    case 'updateLectureProgress': {
      const lecture = await prisma.lecture.findFirst({ where: { id: args.lectureId, course: { semester: { userId } } }, include: { course: true } }); if (!lecture) throw new AppError(404, 'Resource not found');
      const changed = await prisma.lecture.update({ where: { id: lecture.id }, data: { state: args.state, understandingScore: args.understandingScore, needsReview: args.needsReview, notes: args.notes, studiedAt: args.state !== 'TAKEN_NOT_STUDIED' ? new Date() : null, masteredAt: args.state === 'MASTERED' ? new Date() : null }, select: { id: true, courseId: true, number: true, title: true, state: true, understandingScore: true, needsReview: true } });
      if (args.state !== 'TAKEN_NOT_STUDIED') {
        await prisma.studyTask.updateMany({ where: { lectureId: lecture.id, status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED', completedAt: new Date() } });
        if (args.understandingScore) { const days = reviewDelayDays(lecture.course.difficulty, args.understandingScore, args.needsReview); await prisma.review.create({ data: { courseId: lecture.courseId, lectureId: lecture.id, type: 'FIRST_REVIEW', scheduledAt: new Date(Date.now() + days * DAY) } }); }
      } return { ok: true, changed };
    }
    case 'createAssignment': {
      await assessmentAllowed(userId, args.courseId, 'ASSIGNMENT'); const course = await ownedCourse(userId, args.courseId); const deadline = resolveUserDate(args.officialDeadline, timezone); const buffer = Math.min(4, Math.max(1, Math.ceil((args.weight ?? 10) / 10) + (course.difficulty >= 8 ? 1 : 0)));
      const changed = await prisma.assignment.create({ data: { courseId: args.courseId, title: args.title, description: args.description, officialDeadline: deadline, internalDeadline: new Date(deadline.getTime() - buffer * DAY), weight: args.weight }, select: { id: true, courseId: true, title: true, officialDeadline: true, internalDeadline: true, status: true } }); return { ok: true, changed, resolvedDate: deadline };
    }
    case 'updateAssignment': {
      const existing = await prisma.assignment.findFirst({ where: { id: args.assignmentId, course: { semester: { userId } } } }); if (!existing) throw new AppError(404, 'Resource not found'); const deadline = args.officialDeadline ? resolveUserDate(args.officialDeadline, timezone) : undefined;
      const changed = await prisma.assignment.update({ where: { id: existing.id }, data: { title: args.title ?? undefined, officialDeadline: deadline, progress: args.progress ?? undefined, status: args.status ?? undefined }, select: { id: true, courseId: true, title: true, officialDeadline: true, progress: true, status: true } }); return { ok: true, changed, resolvedDate: deadline };
    }
    case 'createExam': {
      await assessmentAllowed(userId, args.courseId, args.type === 'QUIZ' ? 'QUIZ' : args.type); const date = resolveUserDate(args.date, timezone);
      const changed = await prisma.exam.create({ data: { courseId: args.courseId, type: args.type, title: args.title, date, weight: args.weight, coveredTopics: args.coveredTopics, coveredLectures: [] }, select: { id: true, courseId: true, type: true, title: true, date: true, preparationStatus: true } }); return { ok: true, changed, resolvedDate: date };
    }
    case 'updateExam': {
      const existing = await prisma.exam.findFirst({ where: { id: args.examId, course: { semester: { userId } } } }); if (!existing) throw new AppError(404, 'Resource not found');
      if (args.date) { const proposed = { ...args, date: resolveUserDate(args.date, timezone).toISOString() }; const expected = fingerprint(name, proposed); if (context.approvedFingerprint !== expected) return confirmation(name, proposed, `Change exam date from ${existing.date.toISOString()} to ${proposed.date}`); args.date = proposed.date; }
      const changed = await prisma.exam.update({ where: { id: existing.id }, data: { title: args.title ?? undefined, date: args.date ? new Date(args.date) : undefined, preparationStatus: args.preparationStatus ?? undefined, confidenceLevel: args.confidenceLevel }, select: { id: true, courseId: true, title: true, date: true, preparationStatus: true, confidenceLevel: true } }); return { ok: true, changed };
    }
    case 'createProject': {
      await assessmentAllowed(userId, args.courseId, 'PROJECT'); const course = await ownedCourse(userId, args.courseId); const deadline = resolveUserDate(args.officialDeadline, timezone); const buffer = Math.min(7, Math.max(3, Math.ceil((args.weight ?? 20) / 8) + (course.difficulty >= 8 ? 1 : 0)));
      const changed = await prisma.project.create({ data: { courseId: args.courseId, name: args.name, description: args.description, officialDeadline: deadline, internalDeadline: new Date(deadline.getTime() - buffer * DAY), weight: args.weight }, select: { id: true, courseId: true, name: true, officialDeadline: true, internalDeadline: true, status: true } }); return { ok: true, changed, resolvedDate: deadline };
    }
    case 'createProjectMilestone': {
      const project = await prisma.project.findFirst({ where: { id: args.projectId, course: { semester: { userId } } }, include: { _count: { select: { milestones: true } } } }); if (!project) throw new AppError(404, 'Resource not found');
      const changed = await prisma.projectMilestone.create({ data: { projectId: project.id, title: args.title, dueAt: args.dueAt ? resolveUserDate(args.dueAt, timezone) : null, order: project._count.milestones }, select: { id: true, projectId: true, title: true, dueAt: true, status: true, order: true } }); return { ok: true, changed };
    }
    case 'recordGrade': {
      await assessmentAllowed(userId, args.courseId, args.assessmentType); if (args.score > args.maximumScore) throw new AppError(400, 'Score cannot exceed maximum score');
      const changed = await prisma.grade.create({ data: { courseId: args.courseId, assessmentType: args.assessmentType, title: args.title, score: args.score, maximumScore: args.maximumScore, weight: args.weight, date: resolveUserDate(args.date, timezone) }, select: { id: true, courseId: true, assessmentType: true, title: true, score: true, maximumScore: true, weight: true, date: true } }); return { ok: true, changed };
    }
    case 'addWeakTopic': {
      await ownedCourse(userId, args.courseId); const changed = await prisma.weakTopic.create({ data: { courseId: args.courseId, topic: args.topic, severity: args.severity, description: args.description }, select: { id: true, courseId: true, topic: true, severity: true, resolved: true } }); await prisma.review.create({ data: { courseId: args.courseId, weakTopicId: changed.id, type: 'WEAK_TOPIC_REVIEW', scheduledAt: new Date(Date.now() + (args.severity === 'HIGH' ? 1 : args.severity === 'MEDIUM' ? 3 : 7) * DAY) } }); return { ok: true, changed };
    }
    case 'resolveWeakTopic': {
      const existing = await prisma.weakTopic.findFirst({ where: { id: args.weakTopicId, course: { semester: { userId } } } }); if (!existing) throw new AppError(404, 'Resource not found'); const changed = await prisma.weakTopic.update({ where: { id: existing.id }, data: { resolved: true, resolvedAt: new Date() }, select: { id: true, courseId: true, topic: true, resolved: true, resolvedAt: true } }); return { ok: true, changed };
    }
    default: throw new AppError(400, 'Unknown AI tool');
  }
}
