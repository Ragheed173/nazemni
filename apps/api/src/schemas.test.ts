import { describe, expect, it } from 'vitest';
import { lectureInput, semesterCourseCreateInput, semesterCourseUpdateInput } from './schemas.js';

describe('semester enrollment configuration', () => {
  it('accepts a new catalog course with schedule and multiple quizzes', () => {
    const result = semesterCourseCreateInput.parse({
      newCourse: { courseCode: 'TEST101', nameAr: 'مادة اختبار', nameEn: 'Test Course', defaultCredits: 3 },
      credits: 3,
      difficulty: 7,
      targetGrade: 'B+',
      schedule: [
        { dayOfWeek: 0, startsAt: '14:00', endsAt: '15:00', isOnline: false },
        { dayOfWeek: 2, startsAt: '14:00', endsAt: '15:00', isOnline: true },
      ],
      assessmentComponents: [
        { type: 'QUIZ', name: 'Quiz 1', order: 0 },
        { type: 'QUIZ', name: 'Quiz 2', order: 1 },
        { type: 'ASSIGNMENT', name: 'Assignments', order: 2 },
        { type: 'FINAL', name: 'Final', order: 3 },
      ],
    });
    expect(result.assessmentComponents.filter((component) => component.type === 'QUIZ')).toHaveLength(2);
    expect(result.assessmentComponents.some((component) => component.type === 'MIDTERM')).toBe(false);
    expect(result.schedule).toHaveLength(2);
  });

  it('allows difficulty and retake to change independently of catalog data', () => {
    const result = semesterCourseUpdateInput.parse({ difficulty: 9, retake: true, previousGrade: 1.5 });
    expect(result).toEqual({ difficulty: 9, retake: true, previousGrade: 1.5 });
  });
});

describe('lecture backlog input', () => {
  it('accepts the new lecture fields without a visible title or number', () => {
    const result = lectureInput.parse({
      courseId: 'course-1',
      lectureDate: '2026-09-21',
      durationMinutes: 75,
      deliveryMode: 'ONLINE',
      attended: false,
      needsReview: true,
      notes: 'Review the examples.',
    });

    expect(result).toMatchObject({
      courseId: 'course-1',
      durationMinutes: 75,
      deliveryMode: 'ONLINE',
      attended: false,
      needsReview: true,
    });
    expect(result.title).toBeUndefined();
    expect(result.number).toBeUndefined();
  });

  it('rejects an invalid duration and delivery mode', () => {
    expect(() => lectureInput.parse({
      courseId: 'course-1',
      lectureDate: '2026-09-21',
      durationMinutes: 0,
      deliveryMode: 'RECORDED',
      attended: true,
    })).toThrow();
  });
});
