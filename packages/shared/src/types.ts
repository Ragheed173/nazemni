export type PriorityLevel = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED';
export type CourseStatus = 'ON_TRACK' | 'NEEDS_ATTENTION' | 'AT_RISK';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PriorityCandidate {
  id: string;
  title: string;
  dueDate?: Date | string | null;
  examDate?: Date | string | null;
  difficulty: number;
  backlogAgeDays?: number;
  gradeRisk?: number;
  weakTopicSeverity?: Severity | null;
  daysSinceReview?: number;
  retake?: boolean;
  retakeBonus?: number;
  previousGrade?: number | null;
  deferredCount?: number;
  assessmentWeight?: number | null;
  weeklyCoverageCount?: number;
  baseImportance?: number;
  completed?: boolean;
}

export interface PriorityResult {
  score: number;
  level: PriorityLevel;
  reasons: string[];
}

export interface WeeklyInputs {
  completedTasks: number;
  plannedTasks: number;
  overdueItems: number;
  coursesCovered: number;
  totalCourses: number;
  reviewsCompleted: number;
  reviewsDue: number;
  deferredTasks: number;
  assignmentProgress: number;
  projectProgress: number;
  examPreparation: number;
}

export interface CourseRiskInput {
  backlogCount: number;
  highWeakTopics: number;
  overdueAssessments: number;
  lectureCompletion: number;
  daysSinceStudy: number;
  currentWeightedScore?: number | null;
  examWithinDays?: number | null;
  weeklyCovered: boolean;
}
