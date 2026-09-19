import { describe, expect, it } from 'vitest';
import { calculatePriority } from '@nazemni/shared';
import { currentSemesterCourses, currentSemesterSchedule } from './current-semester.js';

describe('current semester data', () => {
  it('replaces Theory of Computation with Introduction to Statistical Analysis', () => {
    expect(currentSemesterCourses.map((course) => course.code)).not.toContain('10672116');
    expect(currentSemesterCourses.map((course) => course.nameEn)).not.toContain('Theory of Computation');

    expect(currentSemesterCourses.find((course) => course.code === '10672228')).toMatchObject({
      nameEn: 'Introduction to Statistical Analysis',
      nameAr: 'مقدمة في التحليل الاحصائي',
      credits: 3,
      difficulty: 7,
      retake: false,
      assessmentTypes: ['QUIZ', 'MIDTERM', 'ASSIGNMENT', 'FINAL'],
    });
  });

  it('keeps Computer Networks as the only retake course', () => {
    expect(currentSemesterCourses.filter((course) => course.retake).map((course) => course.code)).toEqual(['NET']);

    const results = currentSemesterCourses.map((course) => ({
      code: course.code,
      reasons: calculatePriority({
        id: course.code,
        title: course.nameEn,
        difficulty: course.difficulty,
        retake: course.retake,
        previousGrade: course.previousGrade,
      }).reasons,
    }));
    expect(results.filter((result) => result.reasons.includes('Retake with GPA replacement effect')).map((result) => result.code)).toEqual(['NET']);
  });

  it('schedules statistics Sunday, Tuesday, and Thursday from 14:00 to 15:00', () => {
    expect(currentSemesterSchedule.filter(([code]) => code === '10672228')).toEqual([
      ['10672228', 0, '14:00', '15:00', false],
      ['10672228', 2, '14:00', '15:00', false],
      ['10672228', 4, '14:00', '15:00', false],
    ]);
  });
});
