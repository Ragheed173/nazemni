import type { Prisma } from '@prisma/client';

export const activeEnrollmentFilter = (userId: string) => ({
  enrollmentStatus: 'ACTIVE' as const,
  semester: { isCurrent: true, userId },
}) satisfies Prisma.SemesterCourseWhereInput;

export const ownedEnrollmentFilter = (userId: string) => ({
  semester: { userId },
}) satisfies Prisma.SemesterCourseWhereInput;

export const enrollmentCatalogInclude = {
  catalog: true,
} satisfies Prisma.SemesterCourseInclude;

export type EnrollmentWithCatalog = Prisma.SemesterCourseGetPayload<{
  include: typeof enrollmentCatalogInclude;
}>;

export function courseView(enrollment: EnrollmentWithCatalog) {
  const { catalog, ...semesterFields } = enrollment;
  return {
    ...semesterFields,
    code: catalog.courseCode,
    courseCode: catalog.courseCode,
    nameEn: catalog.nameEn,
    nameAr: catalog.nameAr,
    defaultCredits: catalog.defaultCredits,
    archived: catalog.archived,
  };
}

export function entityCourseView<T extends { course: EnrollmentWithCatalog }>(entity: T) {
  return { ...entity, course: courseView(entity.course) };
}
