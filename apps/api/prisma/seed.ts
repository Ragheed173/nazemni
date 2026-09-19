import { PrismaClient } from '@prisma/client';
import { priorityWeights } from '@nazemni/shared';
import { currentSemesterCourses, currentSemesterSchedule } from '../src/data/current-semester.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_OWNER_PASSWORD;
  if (!seedPassword || seedPassword.length < 10) throw new Error('SEED_OWNER_PASSWORD must be at least 10 characters');
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? 'developer@example.test').toLowerCase();
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: { id: randomUUID(), email: ownerEmail, username: 'ragheed', name: 'ragheed', displayUsername: 'ragheed', role: 'ADMIN' },
  });
  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: owner.id } },
    update: { password: await bcrypt.hash(seedPassword, 12) },
    create: { providerId: 'credential', accountId: owner.id, userId: owner.id, password: await bcrypt.hash(seedPassword, 12) },
  });
  await prisma.appSettings.upsert({
    where: { userId: owner.id },
    update: {},
    create: { userId: owner.id, priorityWeights, language: 'ar', defaultTarget: 'B+' },
  });

  const semester = await prisma.semester.upsert({
    where: { id: 'current-semester' },
    update: { isCurrent: true, userId: owner.id },
    create: {
      id: 'current-semester',
      userId: owner.id,
      name: 'Current Semester',
      academicYear: '2026/2027',
      term: 'FALL',
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2027-01-31T00:00:00.000Z'),
      isCurrent: true,
    },
  });

  for (const entry of currentSemesterCourses) {
    const existingCatalog = await prisma.course.findFirst({ where: { ownerId: null, courseCode: entry.code } });
    const catalog = existingCatalog
      ? await prisma.course.update({ where: { id: existingCatalog.id }, data: { nameEn: entry.nameEn, nameAr: entry.nameAr, defaultCredits: entry.credits, archived: false } })
      : await prisma.course.create({ data: { courseCode: entry.code, nameEn: entry.nameEn, nameAr: entry.nameAr, defaultCredits: entry.credits } });
    const enrollment = await prisma.semesterCourse.upsert({
      where: { semesterId_courseId: { semesterId: semester.id, courseId: catalog.id } },
      update: {
        credits: entry.credits,
        difficulty: entry.difficulty,
        retake: entry.retake,
        previousGrade: entry.previousGrade,
        replacementEffect: entry.replacementEffect,
        notes: 'specialNote' in entry ? entry.specialNote : null,
        enrollmentStatus: 'ACTIVE',
      },
      create: {
        semesterId: semester.id,
        courseId: catalog.id,
        credits: entry.credits,
        difficulty: entry.difficulty,
        retake: entry.retake,
        previousGrade: entry.previousGrade,
        replacementEffect: entry.replacementEffect,
        notes: 'specialNote' in entry ? entry.specialNote : null,
      },
    });
    await prisma.assessmentComponent.deleteMany({ where: { semesterCourseId: enrollment.id } });
    if (entry.assessmentTypes.length) {
      await prisma.assessmentComponent.createMany({
        data: entry.assessmentTypes.map((type, order) => ({ semesterCourseId: enrollment.id, type, name: type, order })),
      });
    }
  }

  const savedCourses = await prisma.semesterCourse.findMany({ where: { semesterId: semester.id }, include: { catalog: true } });
  const byCode = new Map(savedCourses.map((course) => [course.catalog.courseCode, course.id]));
  await prisma.scheduleSlot.deleteMany({ where: { course: { semesterId: semester.id } } });
  await prisma.scheduleSlot.createMany({
    data: currentSemesterSchedule.map(([code, dayOfWeek, startsAt, endsAt, isOnline]) => ({
      semesterCourseId: byCode.get(code)!,
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
