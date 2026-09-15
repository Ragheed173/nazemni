import type { PriorityCandidate, PriorityResult } from './types.js';

export const priorityWeights = {
  deadline: 28, exam: 24, difficulty: 12, backlog: 14, gradeRisk: 12,
  reviewAge: 8, retake: 8, weakTopic: 10, deferment: 7,
  assessment: 10, coverage: 9, importance: 8,
} as const;

const daysUntil = (value?: Date | string | null, now = new Date()) =>
  value ? Math.ceil((new Date(value).getTime() - now.getTime()) / 86_400_000) : null;

const urgency = (days: number | null) => {
  if (days === null) return 0;
  if (days < 0) return 1;
  if (days <= 1) return 0.95;
  if (days <= 3) return 0.8;
  if (days <= 7) return 0.55;
  if (days <= 14) return 0.25;
  return 0.05;
};

export function calculatePriority(candidate: PriorityCandidate, now = new Date()): PriorityResult {
  if (candidate.completed) return { score: 0, level: 'OPTIONAL', reasons: ['Completed'] };
  const reasons: string[] = [];
  let score = 0;
  const deadlineDays = daysUntil(candidate.dueDate, now);
  const examDays = daysUntil(candidate.examDate, now);
  const deadlineValue = urgency(deadlineDays);
  const examValue = urgency(examDays);
  score += deadlineValue * priorityWeights.deadline;
  score += examValue * priorityWeights.exam;
  if (deadlineValue >= 0.55) {
    reasons.push(deadlineDays! < 0 ? 'Overdue deadline' : 'Deadline in ' + deadlineDays + ' day(s)');
  }
  if (examValue >= 0.55) reasons.push('Exam in ' + Math.max(0, examDays!) + ' day(s)');
  score += (Math.max(1, candidate.difficulty) / 10) * priorityWeights.difficulty;
  if (candidate.difficulty >= 8) reasons.push('High-difficulty course');
  score += (Math.min(candidate.backlogAgeDays ?? 0, 14) / 14) * priorityWeights.backlog;
  if ((candidate.backlogAgeDays ?? 0) >= 3) reasons.push(candidate.backlogAgeDays + ' days in backlog');
  score += Math.min(candidate.gradeRisk ?? 0, 1) * priorityWeights.gradeRisk;
  if ((candidate.gradeRisk ?? 0) >= 0.6) reasons.push('Grade needs protection');
  score += (Math.min(candidate.daysSinceReview ?? 0, 14) / 14) * priorityWeights.reviewAge;
  if ((candidate.daysSinceReview ?? 0) >= 7) reasons.push('Review is due');
  if (candidate.retake) {
    const replacementRisk = candidate.previousGrade == null ? 0.5 : Math.max(0.3, 1 - candidate.previousGrade / 4);
    score += replacementRisk * (candidate.retakeBonus ?? priorityWeights.retake);
    reasons.push('Retake with GPA replacement effect');
  }
  const weakMap = { LOW: 0.25, MEDIUM: 0.6, HIGH: 1 } as const;
  if (candidate.weakTopicSeverity) {
    score += weakMap[candidate.weakTopicSeverity] * priorityWeights.weakTopic;
    reasons.push(candidate.weakTopicSeverity.toLowerCase() + '-severity weak topic');
  }
  score += (Math.min(candidate.deferredCount ?? 0, 4) / 4) * priorityWeights.deferment;
  if ((candidate.deferredCount ?? 0) > 0) reasons.push('Deferred ' + candidate.deferredCount + ' time(s)');
  score += Math.min((candidate.assessmentWeight ?? 0) / 40, 1) * priorityWeights.assessment;
  if ((candidate.assessmentWeight ?? 0) >= 15) reasons.push('High assessment weight');
  const coverageNeed = candidate.weeklyCoverageCount === 0 ? 1 : candidate.weeklyCoverageCount === 1 ? 0.35 : 0;
  score += coverageNeed * priorityWeights.coverage;
  if (coverageNeed === 1) reasons.push('Course has not been covered this week');
  score += Math.min(candidate.baseImportance ?? 0.5, 1) * priorityWeights.importance;
  const rounded = Math.round(Math.min(score, 100));
  return {
    score: rounded,
    level: rounded >= 65 ? 'CRITICAL' : rounded >= 38 ? 'IMPORTANT' : 'OPTIONAL',
    reasons: reasons.slice(0, 3),
  };
}
