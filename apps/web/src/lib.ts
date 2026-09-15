import type { Course } from './types';

export const courseName = (course: Pick<Course, 'nameAr' | 'nameEn'>, language: string) =>
  language === 'ar' ? course.nameAr : course.nameEn;

export const formatDate = (value: string | Date, language: string) =>
  new Intl.DateTimeFormat(language === 'ar' ? 'ar-PS' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));

export const toDateInput = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : '';
