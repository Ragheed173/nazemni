import { describe, expect, it } from 'vitest';
import {
  calculateCourseStatus,
  calculateGradeStanding,
  calculatePriority,
  calculateWeeklyScore,
  detectBacklogRisk,
  detectFocusMode,
  reviewDelayDays,
} from './index.js';

describe('priority engine', () => {
  const now = new Date('2026-09-15T08:00:00Z');
  it('raises urgent deadlines without making retakes permanently dominant', () => {
    const urgent = calculatePriority({ id: '1', title: 'Project', difficulty: 7, dueDate: '2026-09-16', assessmentWeight: 25 }, now);
    const retake = calculatePriority({ id: '2', title: 'Lecture', difficulty: 9, retake: true, previousGrade: 0 }, now);
    expect(urgent.score).toBeGreaterThan(retake.score);
  });

  it('escalates repeated deferment', () => {
    const base = calculatePriority({ id: '1', title: 'Lecture', difficulty: 6 }, now);
    const deferred = calculatePriority({ id: '1', title: 'Lecture', difficulty: 6, deferredCount: 4 }, now);
    expect(deferred.score).toBeGreaterThan(base.score);
  });

  it('applies the retake bonus from enrollment data and removes it when the flag is cleared', () => {
    const base = { id: 'same-course', title: 'Study', difficulty: 7, previousGrade: 1.5 };
    const regular = calculatePriority({ ...base, retake: false }, now);
    const retake = calculatePriority({ ...base, retake: true }, now);
    expect(retake.score).toBeGreaterThan(regular.score);
    expect(retake.reasons).toContain('Retake with GPA replacement effect');
    expect(regular.reasons).not.toContain('Retake with GPA replacement effect');
  });
});

describe('study metrics', () => {
  it('calculates an understandable weekly score', () => {
    const result = calculateWeeklyScore({
      completedTasks: 8, plannedTasks: 10, overdueItems: 1, coursesCovered: 5,
      totalCourses: 6, reviewsCompleted: 3, reviewsDue: 4, deferredTasks: 1,
      assignmentProgress: 70, projectProgress: 60, examPreparation: 80,
    });
    expect(result.score).toBeGreaterThan(60);
    expect(result.score).toBeLessThan(90);
  });

  it('marks a neglected risky course at risk', () => {
    expect(calculateCourseStatus({
      backlogCount: 4, highWeakTopics: 1, overdueAssessments: 1,
      lectureCompletion: 45, daysSinceStudy: 10, currentWeightedScore: 68,
      examWithinDays: 3, weeklyCovered: false,
    })).toBe('AT_RISK');
  });

  it('schedules weak lectures sooner', () => {
    expect(reviewDelayDays(9, 4, true)).toBe(1);
    expect(reviewDelayDays(5, 9)).toBe(7);
  });

  it('activates focus mode for a nearby event', () => {
    expect(detectFocusMode([{ title: 'Networks Midterm', date: '2026-09-19' }], new Date('2026-09-15'))).toMatchObject({ active: true });
  });

  it('calculates weighted standing from known weights', () => {
    const result = calculateGradeStanding([
      { score: 18, maximum: 20, weight: 20 },
      { score: 8, maximum: 10, weight: 10 },
    ]);
    expect(result.current).toBeCloseTo(86.67, 1);
    expect(result.gradedWeight).toBe(30);
  });

  it('detects overdue and repeatedly deferred backlog without flagging completed work', () => {
    expect(detectBacklogRisk({ kind: 'TASK', deferredCount: 3 }).isBacklog).toBe(true);
    expect(detectBacklogRisk({ kind: 'REVIEW', overdue: true }).reasons).toContain('Overdue review');
    expect(detectBacklogRisk({ kind: 'ASSESSMENT', overdue: true, completed: true }).isBacklog).toBe(false);
  });
});
