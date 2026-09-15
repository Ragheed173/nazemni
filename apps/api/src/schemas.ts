import { z } from 'zod';

const optionalDate = z.coerce.date().optional().nullable();
const boundedProgress = z.coerce.number().int().min(0).max(100);

export const lectureInput = z.object({
  courseId: z.string().min(1),
  number: z.coerce.number().int().positive(),
  title: z.string().min(2).max(160),
  lectureDate: z.coerce.date(),
  takenAtUniversity: z.boolean().default(true),
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
  weeklyReviewDay: z.coerce.number().int().min(0).max(6).optional(),
  defaultTarget: z.string().min(1).max(10).optional(),
  retakeBonus: z.coerce.number().int().min(0).max(30).optional(),
  firstReviewHours: z.coerce.number().int().min(6).max(168).optional(),
  focusModeManual: z.boolean().optional().nullable(),
  focusModeReason: z.string().max(240).optional().nullable(),
});
