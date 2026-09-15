import { PrismaClient } from '@prisma/client';
import { priorityWeights } from '@nazemni/shared';

const prisma = new PrismaClient();

const courses = [
  { code: 'NET', nameEn: 'Computer Networks', nameAr: 'شبكات الحاسوب', difficulty: 9, credits: 3, retake: true, previousGrade: 0, replacementEffect: true },
  { code: 'TOC', nameEn: 'Theory of Computation', nameAr: 'نظرية الحسابات', difficulty: 6, credits: 3, retake: true, previousGrade: 0.75, replacementEffect: true },
  { code: 'BDE', nameEn: 'Big Data Engineering', nameAr: 'هندسة البيانات الضخمة', difficulty: 9, credits: 3, retake: false, previousGrade: null, replacementEffect: false },
  { code: 'CYB', nameEn: 'Cybersecurity', nameAr: 'الأمن في الفضاء الإلكتروني', difficulty: 8, credits: 3, retake: false, previousGrade: null, replacementEffect: false },
  { code: 'ENG102', nameEn: 'English 102 / Virtual Exchange', nameAr: 'لغة إنجليزية (2) - تبادل افتراضي', difficulty: 5, credits: 3, retake: false, previousGrade: null, replacementEffect: false, specialNote: 'No Midterm' },
  { code: 'INN', nameEn: 'Innovation & Entrepreneurship', nameAr: 'الابتكار وريادة الأعمال', difficulty: 5, credits: 3, retake: false, previousGrade: null, replacementEffect: false, specialNote: 'No Midterm' },
] as const;

const schedule = [
  ['INN', 0, '09:00', '10:00', false], ['CYB', 0, '10:00', '11:00', false],
  ['TOC', 0, '12:00', '13:00', false], ['NET', 0, '13:00', '14:00', false],
  ['ENG102', 1, '09:00', '10:00', true], ['BDE', 1, '10:00', '11:00', true],
  ['INN', 2, '09:00', '10:00', false], ['CYB', 2, '10:00', '11:00', false],
  ['TOC', 2, '12:00', '13:00', false], ['NET', 2, '13:00', '14:00', false],
  ['ENG102', 3, '10:00', '12:00', false], ['BDE', 3, '12:00', '14:00', false],
  ['INN', 4, '09:00', '10:00', true], ['CYB', 4, '10:00', '11:00', true],
  ['TOC', 4, '12:00', '13:00', true], ['NET', 4, '13:00', '14:00', true],
] as const;

async function main() {
  await prisma.appSettings.upsert({
    where: { id: 'settings' },
    update: {},
    create: { id: 'settings', priorityWeights, language: 'ar', defaultTarget: 'B+' },
  });

  const semester = await prisma.semester.upsert({
    where: { id: 'current-semester' },
    update: { isCurrent: true },
    create: {
      id: 'current-semester',
      name: 'Current Semester',
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2027-01-31T00:00:00.000Z'),
      creditHours: 18,
      targetGrade: 'B+',
      isCurrent: true,
    },
  });

  for (const entry of courses) {
    await prisma.course.upsert({
      where: { semesterId_code: { semesterId: semester.id, code: entry.code } },
      update: entry,
      create: { ...entry, semesterId: semester.id },
    });
  }

  const savedCourses = await prisma.course.findMany({ where: { semesterId: semester.id } });
  const byCode = new Map(savedCourses.map((course) => [course.code, course.id]));
  await prisma.universitySchedule.deleteMany({ where: { course: { semesterId: semester.id } } });
  await prisma.universitySchedule.createMany({
    data: schedule.map(([code, dayOfWeek, startsAt, endsAt, isOnline]) => ({
      courseId: byCode.get(code)!,
      dayOfWeek,
      startsAt,
      endsAt,
      isOnline,
    })),
  });
}

main()
  .then(() => console.log('Nazemni seed completed.'))
  .finally(() => prisma.$disconnect());
