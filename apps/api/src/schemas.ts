import { z } from 'zod';

const optionalDate = z.coerce.date().optional().nullable();
const boundedProgress = z.coerce.number().int().min(0).max(100);

export const lectureInput = z.object({
  courseId: z.string().min(1),
  number: z.coerce.number().int().positive().optional(),
  title: z.string().min(2).max(160).optional(),
  lectureDate: z.coerce.date(),
  takenAtUniversity: z.boolean().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440).default(60),
  deliveryMode: z.enum(['IN_PERSON', 'ONLINE']).default('IN_PERSON'),
  attended: z.boolean().default(false),
  state: z.enum(['TAKEN_NOT_STUDIED', 'STUDIED', 'NEEDS_REVIEW', 'MASTERED']).default('TAKEN_NOT_STUDIED'),
  understandingScore: z.coerce.number().int().min(1).max(10).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  needsReview: z.boolean().default(false),
});

export const taskInput = z.object({
  courseId: z.string().min(1),
  lectureId: z.string().optional().nullable(),
  title: z.string().min(2).max(180),
  description: z.string().max(4000).optional().nullable(),
  type: z.enum(['LECTURE', 'REVIEW', 'ASSIGNMENT', 'PROJECT', 'EXAM_PREP', 'PRACTICE', 'OTHER']),
  priority: z.enum(['CRITICAL', 'IMPORTANT', 'OPTIONAL']).default('IMPORTANT'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED']).default('TODO'),
  dueAt: optionalDate,
  estimatedEffort: z.coerce.number().int().positive().max(600).optional().nullable(),
  source: z.string().max(240).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export const assignmentInput = z.object({
  courseId: z.string(),
  title: z.string().min(2).max(180),
  description: z.string().max(4000).optional().nullable(),
  releaseDate: optionalDate,
  officialDeadline: z.coerce.date(),
  internalDeadline: optionalDate,
  weight: z.coerce.number().min(0).max(100).optional().nullable(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'READY_TO_SUBMIT', 'SUBMITTED', 'GRADED']).default('NOT_STARTED'),
  progress: boundedProgress.default(0),
  priority: z.enum(['CRITICAL', 'IMPORTANT', 'OPTIONAL']).default('IMPORTANT'),
  notes: z.string().max(4000).optional().nullable(),
});

export const projectInput = z.object({
  courseId: z.string(),
  name: z.string().min(2).max(180),
  description: z.string().max(4000).optional().nullable(),
  startDate: optionalDate,
  officialDeadline: z.coerce.date(),
  internalDeadline: optionalDate,
  weight: z.coerce.number().min(0).max(100).optional().nullable(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'SUBMITTED']).default('NOT_STARTED'),
  progress: boundedProgress.default(0),
  notes: z.string().max(4000).optional().nullable(),
  addDefaultMilestones: z.boolean().default(true),
});

export const examInput = z.object({
  courseId: z.string(),
  type: z.enum(['QUIZ', 'MIDTERM', 'FINAL']),
  title: z.string().min(2).max(180),
  date: z.coerce.date(),
  coveredLectures: z.array(z.coerce.number().int().positive()).default([]),
  coveredTopics: z.array(z.string().min(1)).default([]),
  notes: z.string().max(4000).optional().nullable(),
  preparationStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED']).default('NOT_STARTED'),
  preparationStartAt: optionalDate,
  confidenceLevel: z.coerce.number().int().min(1).max(10).optional().nullable(),
  weight: z.coerce.number().min(0).max(100).optional().nullable(),
});

export const gradeInput = z.object({
  courseId: z.string(),
  assessmentType: z.enum(['QUIZ', 'ASSIGNMENT', 'PROJECT', 'MIDTERM', 'FINAL', 'PARTICIPATION', 'OTHER']),
  title: z.string().min(2).max(180),
  score: z.coerce.number().min(0),
  maximumScore: z.coerce.number().positive(),
  weight: z.coerce.number().min(0).max(100).optional().nullable(),
  date: z.coerce.date(),
  notes: z.string().max(4000).optional().nullable(),
});

export const weakTopicInput = z.object({
  courseId: z.string(),
  topic: z.string().min(2).max(180),
  description: z.string().max(4000).optional().nullable(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  notes: z.string().max(4000).optional().nullable(),
});

export const checkOutInput = z.object({
  date: z.coerce.date(),
  completedTaskIds: z.array(z.string()).default([]),
  deferredTaskIds: z.array(z.string()).default([]),
  inProgressTaskIds: z.array(z.string()).default([]),
  stoppedAt: z.string().max(300).optional().nullable(),
  misunderstoodTopics: z.array(z.string().min(1)).default([]),
  courseId: z.string().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  selfRating: z.coerce.number().int().min(1).max(10).optional().nullable(),
});

export const settingsInput = z.object({
  language: z.enum(['ar', 'en']).optional(),
  timezone: z.string().trim().min(1).max(100).refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }, 'Invalid timezone').optional(),
  weeklyReviewDay: z.coerce.number().int().min(0).max(6).optional(),
  defaultTarget: z.string().min(1).max(10).optional(),
  retakeBonus: z.coerce.number().int().min(0).max(30).optional(),
  firstReviewHours: z.coerce.number().int().min(6).max(168).optional(),
  focusModeManual: z.boolean().optional().nullable(),
  focusModeReason: z.string().max(240).optional().nullable(),
});

export const semesterInput = z.object({
  name: z.string().min(2).max(120),
  academicYear: z.string().min(4).max(20),
  term: z.string().min(2).max(40),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isCurrent: z.boolean().optional(),
}).refine((value) => value.endsAt > value.startsAt, {
  message: 'Semester end date must be after its start date',
  path: ['endsAt'],
});

export const semesterUpdateInput = z.object({
  name: z.string().min(2).max(120).optional(),
  academicYear: z.string().min(4).max(20).optional(),
  term: z.string().min(2).max(40).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isCurrent: z.boolean().optional(),
});

export const catalogCourseInput = z.object({
  courseCode: z.string().trim().min(1).max(40),
  nameAr: z.string().trim().min(2).max(180),
  nameEn: z.string().trim().min(2).max(180),
  defaultCredits: z.coerce.number().int().min(1).max(30),
  archived: z.boolean().optional().default(false),
});

export const scheduleSlotInput = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isOnline: z.boolean().default(false),
  location: z.string().trim().max(160).optional().nullable(),
}).refine((value) => value.endsAt > value.startsAt, {
  message: 'End time must be after start time',
  path: ['endsAt'],
});

export const assessmentComponentInput = z.object({
  type: z.enum(['QUIZ', 'ASSIGNMENT', 'PROJECT', 'MIDTERM', 'FINAL', 'PARTICIPATION', 'OTHER']),
  name: z.string().trim().min(1).max(120),
  weight: z.coerce.number().min(0).max(100).optional().nullable(),
  enabled: z.boolean().default(true),
  order: z.coerce.number().int().min(0),
});

const enrollmentFields = z.object({
  credits: z.coerce.number().int().min(1).max(30),
  difficulty: z.coerce.number().int().min(1).max(10),
  targetGrade: z.string().trim().min(1).max(10).default('B'),
  retake: z.boolean().default(false),
  previousGrade: z.coerce.number().min(0).max(4).optional().nullable(),
  replacementEffect: z.boolean().default(false),
  instructor: z.string().trim().max(160).optional().nullable(),
  section: z.string().trim().max(80).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  schedule: z.array(scheduleSlotInput).max(21).default([]),
  assessmentComponents: z.array(assessmentComponentInput).max(30).default([]),
});

export const semesterCourseCreateInput = enrollmentFields.extend({
  courseId: z.string().min(1).optional(),
  newCourse: catalogCourseInput.optional(),
}).refine((value) => Boolean(value.courseId) !== Boolean(value.newCourse), {
  message: 'Choose an existing course or create a new one',
  path: ['courseId'],
});

export const semesterCourseUpdateInput = enrollmentFields.partial();
