-- Separate permanent catalog data from semester-specific enrollment data while
-- preserving every existing enrollment id referenced by study history.
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'DROPPED', 'WITHDRAWN', 'COMPLETED');

ALTER TABLE "Semester"
  ADD COLUMN "academicYear" TEXT,
  ADD COLUMN "term" TEXT;

UPDATE "Semester"
SET
  "academicYear" = EXTRACT(YEAR FROM "startsAt")::int::text || '/' || EXTRACT(YEAR FROM "endsAt")::int::text,
  "term" = CASE
    WHEN EXTRACT(MONTH FROM "startsAt") BETWEEN 8 AND 12 THEN 'FALL'
    WHEN EXTRACT(MONTH FROM "startsAt") BETWEEN 1 AND 5 THEN 'SPRING'
    ELSE 'SUMMER'
  END;

ALTER TABLE "Semester"
  ALTER COLUMN "academicYear" SET NOT NULL,
  ALTER COLUMN "term" SET NOT NULL,
  DROP COLUMN "creditHours",
  DROP COLUMN "targetGrade";

ALTER TABLE "Course" RENAME TO "SemesterCourse";
ALTER TABLE "SemesterCourse" RENAME CONSTRAINT "Course_pkey" TO "SemesterCourse_pkey";
ALTER TABLE "SemesterCourse" RENAME CONSTRAINT "Course_semesterId_fkey" TO "SemesterCourse_semesterId_fkey";

CREATE TABLE "Course" (
  "id" TEXT NOT NULL,
  "courseCode" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "defaultCredits" INTEGER NOT NULL,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Course_courseCode_key" ON "Course"("courseCode");

INSERT INTO "Course" ("id", "courseCode", "nameEn", "nameAr", "defaultCredits", "createdAt", "updatedAt")
SELECT DISTINCT ON ("code")
  'catalog_' || md5("code"), "code", "nameEn", "nameAr", "credits", "createdAt", "updatedAt"
FROM "SemesterCourse"
ORDER BY "code", "updatedAt" DESC;

ALTER TABLE "SemesterCourse"
  ADD COLUMN "courseId" TEXT,
  ADD COLUMN "instructor" TEXT,
  ADD COLUMN "section" TEXT,
  ADD COLUMN "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "notes" TEXT;

UPDATE "SemesterCourse" enrollment
SET
  "courseId" = catalog."id",
  "notes" = enrollment."specialNote"
FROM "Course" catalog
WHERE catalog."courseCode" = enrollment."code";

ALTER TABLE "SemesterCourse" ALTER COLUMN "courseId" SET NOT NULL;

CREATE TABLE "AssessmentComponent" (
  "id" TEXT NOT NULL,
  "semesterCourseId" TEXT NOT NULL,
  "type" "AssessmentType" NOT NULL,
  "name" TEXT NOT NULL,
  "weight" DOUBLE PRECISION,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AssessmentComponent_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AssessmentComponent" ("id", "semesterCourseId", "type", "name", "order")
SELECT
  'assessment_' || md5(enrollment."id" || ':' || component.ord::text),
  enrollment."id",
  component.type,
  initcap(replace(component.type::text, '_', ' ')),
  component.ord::int - 1
FROM "SemesterCourse" enrollment
CROSS JOIN LATERAL unnest(enrollment."assessmentTypes") WITH ORDINALITY AS component(type, ord);

DROP INDEX "Course_semesterId_code_key";
DROP INDEX "Course_semesterId_status_idx";

ALTER TABLE "SemesterCourse"
  DROP COLUMN "code",
  DROP COLUMN "nameEn",
  DROP COLUMN "nameAr",
  DROP COLUMN "specialNote",
  DROP COLUMN "assessmentTypes";

CREATE UNIQUE INDEX "SemesterCourse_semesterId_courseId_key" ON "SemesterCourse"("semesterId", "courseId");
CREATE INDEX "SemesterCourse_semesterId_enrollmentStatus_idx" ON "SemesterCourse"("semesterId", "enrollmentStatus");
CREATE UNIQUE INDEX "AssessmentComponent_semesterCourseId_order_key" ON "AssessmentComponent"("semesterCourseId", "order");
CREATE INDEX "AssessmentComponent_semesterCourseId_enabled_idx" ON "AssessmentComponent"("semesterCourseId", "enabled");

ALTER TABLE "SemesterCourse"
  ADD CONSTRAINT "SemesterCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentComponent"
  ADD CONSTRAINT "AssessmentComponent_semesterCourseId_fkey" FOREIGN KEY ("semesterCourseId") REFERENCES "SemesterCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UniversitySchedule" RENAME TO "ScheduleSlot";
ALTER TABLE "ScheduleSlot" RENAME COLUMN "courseId" TO "semesterCourseId";
ALTER TABLE "ScheduleSlot" RENAME CONSTRAINT "UniversitySchedule_pkey" TO "ScheduleSlot_pkey";
ALTER TABLE "ScheduleSlot" RENAME CONSTRAINT "UniversitySchedule_courseId_fkey" TO "ScheduleSlot_semesterCourseId_fkey";
ALTER INDEX "UniversitySchedule_dayOfWeek_startsAt_idx" RENAME TO "ScheduleSlot_dayOfWeek_startsAt_idx";
