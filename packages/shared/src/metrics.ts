import type { CourseRiskInput, CourseStatus, WeeklyInputs } from './types.js';

export function calculateWeeklyScore(input: WeeklyInputs) {
  const ratio = (a: number, b: number) => (b <= 0 ? 1 : Math.min(a / b, 1));
  const completion = ratio(input.completedTasks, input.plannedTasks);
  const coverage = ratio(input.coursesCovered, input.totalCourses);
  const reviews = ratio(input.reviewsCompleted, input.reviewsDue);
  const backlog = Math.max(0, 1 - input.overdueItems * 0.12 - input.deferredTasks * 0.08);
  const assessments = (input.assignmentProgress + input.projectProgress + input.examPreparation) / 300;
  const score = Math.round((completion * 0.35 + coverage * 0.2 + reviews * 0.15 + backlog * 0.15 + assessments * 0.15) * 100);
  return {
    score,
    completion: Math.round(completion * 100),
    coverage: Math.round(coverage * 100),
    reviews: Math.round(reviews * 100),
    backlog: Math.round(backlog * 100),
    assessments: Math.round(assessments * 100),
  };
}

export function calculateCourseStatus(input: CourseRiskInput): CourseStatus {
  let risk = 0;
  risk += Math.min(input.backlogCount, 5) * 8;
  risk += input.highWeakTopics * 10;
  risk += input.overdueAssessments * 20;
  risk += Math.max(0, 80 - input.lectureCompletion) * 0.25;
  risk += Math.max(0, input.daysSinceStudy - 4) * 2;
  if (input.currentWeightedScore != null && input.currentWeightedScore < 75) risk += 18;
  if (input.examWithinDays != null && input.examWithinDays <= 7) risk += input.examWithinDays <= 3 ? 18 : 10;
  if (!input.weeklyCovered) risk += 12;
  return risk >= 50 ? 'AT_RISK' : risk >= 24 ? 'NEEDS_ATTENTION' : 'ON_TRACK';
}

export function calculateGradeStanding(items: Array<{ score: number; maximum: number; weight?: number | null }>) {
  const weighted = items.filter((item) => item.weight != null);
  if (!weighted.length) return { complete: false, current: null, gradedWeight: 0, required: null };
  const gradedWeight = weighted.reduce((sum, item) => sum + (item.weight ?? 0), 0);
  const earned = weighted.reduce((sum, item) => sum + (item.score / item.maximum) * (item.weight ?? 0), 0);
  const current = gradedWeight ? (earned / gradedWeight) * 100 : null;
  const remaining = Math.max(0, 100 - gradedWeight);
  const needed = (target: number) => remaining ? Math.max(0, ((target - earned) / remaining) * 100) : null;
  return { complete: gradedWeight >= 99.5, current, gradedWeight, required: { B: needed(80), BPlus: needed(85), AMinus: needed(90) } };
}

export function reviewDelayDays(difficulty: number, understanding: number, weak = false) {
  if (weak || understanding <= 4 || difficulty >= 9) return 1;
  if (understanding <= 6 || difficulty >= 7) return 3;
  return 7;
}

export function detectFocusMode(
  events: Array<{ title: string; date: Date | string; importance?: number }>,
  now = new Date(),
) {
  const urgent = events
    .map((event) => ({ ...event, days: Math.ceil((new Date(event.date).getTime() - now.getTime()) / 86_400_000) }))
    .filter((event) => event.days >= 0 && event.days <= 7 && (event.importance ?? 1) >= 0.6)
    .sort((a, b) => a.days - b.days);
  if (!urgent.length) return { active: false, reason: null, event: null };
  return { active: true, reason: urgent[0]!.title + ' in ' + urgent[0]!.days + ' day(s)', event: urgent[0] };
}

export function detectBacklogRisk(input: {
  kind: 'LECTURE' | 'REVIEW' | 'ASSESSMENT' | 'TASK' | 'WEAK_TOPIC';
  completed?: boolean;
  ageDays?: number;
  overdue?: boolean;
  deferredCount?: number;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
}) {
  if (input.completed) return { isBacklog: false, risk: 0, reasons: [] as string[] };
  const reasons: string[] = [];
  if (input.kind === 'LECTURE' && (input.ageDays ?? 0) >= 1) reasons.push('Unstudied lecture');
  if (input.kind === 'REVIEW' && input.overdue) reasons.push('Overdue review');
  if (input.kind === 'ASSESSMENT' && input.overdue) reasons.push('Overdue assessment');
  if (input.kind === 'TASK' && (input.deferredCount ?? 0) >= 2) reasons.push('Repeatedly deferred');
  if (input.kind === 'WEAK_TOPIC' && input.severity === 'HIGH') reasons.push('High-severity weak topic');
  const risk = Math.min(100, reasons.length * 30 + Math.min(input.ageDays ?? 0, 10) * 5 + Math.min(input.deferredCount ?? 0, 4) * 8);
  return { isBacklog: reasons.length > 0, risk, reasons };
}
