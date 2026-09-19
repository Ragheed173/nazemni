import { Router } from 'express';
import { authUser } from '../auth.js';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import {
  catalogCourseInput,
  semesterCourseCreateInput,
  semesterCourseUpdateInput,
  semesterInput,
  semesterUpdateInput,
} from '../schemas.js';

export const semesterManagementRouter = Router();
const ok = (data: unknown) => ({ ok: true, data });

const enrollmentInclude = {
  catalog: true,
  schedule: { orderBy: [{ dayOfWeek: 'asc' as const }, { startsAt: 'asc' as const }] },
  assessmentComponents: { orderBy: { order: 'asc' as const } },
  _count: {
    select: {
      lectures: true, tasks: true, assignments: true, projects: true,
      exams: true, grades: true, weakTopics: true, reviews: true,
    },
  },
};

const enrollmentView = <T extends { catalog: { courseCode: string; nameEn: string; nameAr: string; defaultCredits: number; archived: boolean } }>(enrollment: T) => {
  const { catalog, ...rest } = enrollment;
  return {
    ...rest,
    code: catalog.courseCode,
    courseCode: catalog.courseCode,
    nameEn: catalog.nameEn,
    nameAr: catalog.nameAr,
    defaultCredits: catalog.defaultCredits,
    archived: catalog.archived,
  };
};

semesterManagementRouter.get('/semester-management', async (_request, response) => {
  const userId = authUser(response).id;
  const semester = await prisma.semester.findFirst({ where: { userId, isCurrent: true } });
  const [enrollments, catalog] = await Promise.all([
    semester
      ? prisma.semesterCourse.findMany({
          where: { semesterId: semester.id, semester: { userId } },
          include: enrollmentInclude,
          orderBy: [{ enrollmentStatus: 'asc' }, { catalog: { courseCode: 'asc' } }],
        })
      : [],
    prisma.course.findMany({
      where: { OR: [{ ownerId: null }, { ownerId: userId }] },
      orderBy: [{ archived: 'asc' }, { courseCode: 'asc' }],
    }),
  ]);
  response.json(ok({ semester, enrollments: enrollments.map(enrollmentView), catalog }));
});

semesterManagementRouter.post('/semesters', async (request, response) => {
  const userId = authUser(response).id;
  const input = semesterInput.parse(request.body);
  const semester = await prisma.$transaction(async (tx) => {
    if (input.isCurrent !== false) {
      await tx.semester.updateMany({ where: { userId, isCurrent: true }, data: { isCurrent: false } });
    }
    return tx.semester.create({ data: { ...input, userId, isCurrent: input.isCurrent ?? true } });
  });
  response.status(201).json(ok(semester));
});

semesterManagementRouter.patch('/semesters/:id', async (request, response) => {
  const userId = authUser(response).id;
  const input = semesterUpdateInput.parse(request.body);
  const existing = await prisma.semester.findFirst({ where: { id: request.params.id, userId } });
  if (!existing) throw new AppError(404, 'Resource not found');
  const startsAt = input.startsAt ?? existing.startsAt;
  const endsAt = input.endsAt ?? existing.endsAt;
  if (endsAt <= startsAt) throw new AppError(400, 'Semester end date must be after its start date');
  const semester = await prisma.$transaction(async (tx) => {
    if (input.isCurrent) {
      await tx.semester.updateMany({ where: { userId, id: { not: existing.id }, isCurrent: true }, data: { isCurrent: false } });
    }
    return tx.semester.update({ where: { id: existing.id }, data: input });
  });
  response.json(ok(semester));
});

semesterManagementRouter.post('/catalog-courses', async (request, response) => {
  const userId = authUser(response).id;
  const input = catalogCourseInput.parse(request.body);
  const duplicate = await prisma.course.findFirst({ where: { ownerId: userId, courseCode: input.courseCode } });
  if (duplicate) throw new AppError(409, 'A course with this code already exists');
  response.status(201).json(ok(await prisma.course.create({ data: { ...input, ownerId: userId } })));
});

semesterManagementRouter.patch('/catalog-courses/:id', async (request, response) => {
  const userId = authUser(response).id;
  const input = catalogCourseInput.partial().parse(request.body);
  const existing = await prisma.course.findFirst({ where: { id: request.params.id, ownerId: userId } });
  if (!existing) throw new AppError(404, 'Resource not found');
  response.json(ok(await prisma.course.update({ where: { id: existing.id }, data: input })));
});

semesterManagementRouter.post('/semester-courses', async (request, response) => {
  const userId = authUser(response).id;
  const input = semesterCourseCreateInput.parse(request.body);
  const semester = await prisma.semester.findFirst({ where: { userId, isCurrent: true } });
  if (!semester) throw new AppError(400, 'Create a current semester first');
  const enrollment = await prisma.$transaction(async (tx) => {
    let courseId = input.courseId;
    if (input.newCourse) {
      const duplicate = await tx.course.findFirst({ where: { ownerId: userId, courseCode: input.newCourse.courseCode } });
      if (duplicate) throw new AppError(409, 'A course with this code already exists');
      courseId = (await tx.course.create({ data: { ...input.newCourse, ownerId: userId } })).id;
    } else {
      const visible = await tx.course.count({ where: { id: courseId, OR: [{ ownerId: null }, { ownerId: userId }] } });
      if (!visible) throw new AppError(404, 'Resource not found');
    }
    const existing = await tx.semesterCourse.findUnique({
      where: { semesterId_courseId: { semesterId: semester.id, courseId: courseId! } },
    });
    if (existing) throw new AppError(409, 'This course is already enrolled in the current semester');
    const { schedule, assessmentComponents, newCourse: _newCourse, ...fields } = input;
    void _newCourse;
    return tx.semesterCourse.create({
      data: {
        ...fields,
        courseId: courseId!,
        semesterId: semester.id,
        schedule: { create: schedule },
        assessmentComponents: { create: assessmentComponents.map((component, order) => ({ ...component, order })) },
      },
      include: enrollmentInclude,
    });
  });
  response.status(201).json(ok(enrollmentView(enrollment)));
});

semesterManagementRouter.patch('/semester-courses/:id', async (request, response) => {
  const userId = authUser(response).id;
  const input = semesterCourseUpdateInput.parse(request.body);
  const owned = await prisma.semesterCourse.findFirst({ where: { id: request.params.id, semester: { userId } } });
  if (!owned) throw new AppError(404, 'Resource not found');
  const enrollment = await prisma.$transaction(async (tx) => {
    const { schedule, assessmentComponents, ...fields } = input;
    if (schedule) {
      await tx.scheduleSlot.deleteMany({ where: { semesterCourseId: owned.id, course: { semester: { userId } } } });
      if (schedule.length) await tx.scheduleSlot.createMany({ data: schedule.map((slot) => ({ ...slot, semesterCourseId: owned.id })) });
    }
    if (assessmentComponents) {
      await tx.assessmentComponent.deleteMany({ where: { semesterCourseId: owned.id, enrollment: { semester: { userId } } } });
      if (assessmentComponents.length) {
        await tx.assessmentComponent.createMany({
          data: assessmentComponents.map((component, order) => ({ ...component, order, semesterCourseId: owned.id })),
        });
      }
    }
    return tx.semesterCourse.update({ where: { id: owned.id }, data: fields, include: enrollmentInclude });
  });
  response.json(ok(enrollmentView(enrollment)));
});

for (const [path, status] of [['drop', 'DROPPED'], ['restore', 'ACTIVE']] as const) {
  semesterManagementRouter.post(`/semester-courses/:id/${path}`, async (request, response) => {
    const userId = authUser(response).id;
    const owned = await prisma.semesterCourse.findFirst({ where: { id: request.params.id, semester: { userId } } });
    if (!owned) throw new AppError(404, 'Resource not found');
    const enrollment = await prisma.semesterCourse.update({
      where: { id: owned.id }, data: { enrollmentStatus: status }, include: enrollmentInclude,
    });
    response.json(ok(enrollmentView(enrollment)));
  });
}
