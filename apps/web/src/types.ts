export interface Course {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  difficulty: number;
  credits: number;
  retake: boolean;
  previousGrade?: number | null;
  replacementEffect: boolean;
  targetGrade: string;
  notes?: string | null;
  enrollmentStatus: 'ACTIVE' | 'DROPPED' | 'WITHDRAWN' | 'COMPLETED';
  instructor?: string | null;
  section?: string | null;
  assessmentComponents: Array<{ id: string; type: string; name: string; weight?: number | null; enabled: boolean; order: number }>;
  status: 'ON_TRACK' | 'NEEDS_ATTENTION' | 'AT_RISK';
  lastStudyAt?: string | null;
  lectureProgress?: number;
  gradeStanding?: GradeStanding;
  _count?: Record<string, number>;
}

export interface GradeStanding {
  complete: boolean;
  current: number | null;
  gradedWeight: number;
  required: null | { B: number | null; BPlus: number | null; AMinus: number | null };
}

export interface PlanItem {
  id: string;
  entityId: string;
  kind: string;
  title: string;
  course: Pick<Course, 'id' | 'nameEn' | 'nameAr'>;
  score: number;
  level: string;
  reasons: string[];
  estimatedEffort?: number | null;
}

export interface DailyPlan {
  generatedAt: string;
  empty: boolean;
  groups: { CRITICAL: PlanItem[]; IMPORTANT: PlanItem[]; OPTIONAL: PlanItem[] };
}

export type EntityRecord = Record<string, unknown> & { id: string; course?: Course };
