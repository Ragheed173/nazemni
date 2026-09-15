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
  specialNote?: string | null;
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

export type EntityRecord = Record<string, any> & { id: string; course?: Course };
