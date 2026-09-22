-- CreateEnum
CREATE TYPE "CourseCatalogStatus" AS ENUM ('VERIFIED', 'PARTIAL', 'NOT_VERIFIED');

-- CreateEnum
CREATE TYPE "CourseCatalogSourceType" AS ENUM ('OFFICIAL_CATALOG', 'OFFICIAL_DEPARTMENT', 'OFFICIAL_SYLLABUS', 'UNIVERSITY_DOCUMENT', 'SECONDARY');

-- CreateTable
CREATE TABLE "CourseCatalogEntry" (
    "id" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "universityNormalized" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "programNormalized" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseCodeNormalized" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "credits" INTEGER,
    "description" TEXT,
    "prerequisites" TEXT[],
    "topics" TEXT[],
    "assessmentInfo" TEXT[],
    "officialUrl" TEXT,
    "status" "CourseCatalogStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCatalogSource" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceType" "CourseCatalogSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseCatalogSource_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SemesterCourse" ADD COLUMN "catalogEntryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CourseCatalogEntry_identity_key" ON "CourseCatalogEntry"("universityNormalized", "programNormalized", "courseCodeNormalized");
CREATE INDEX "CourseCatalogEntry_name_lookup_idx" ON "CourseCatalogEntry"("universityNormalized", "programNormalized", "courseName");
CREATE INDEX "CourseCatalogEntry_lastVerifiedAt_idx" ON "CourseCatalogEntry"("lastVerifiedAt");
CREATE UNIQUE INDEX "CourseCatalogSource_entryId_url_key" ON "CourseCatalogSource"("entryId", "url");
CREATE INDEX "CourseCatalogSource_entryId_isOfficial_idx" ON "CourseCatalogSource"("entryId", "isOfficial");
CREATE INDEX "SemesterCourse_catalogEntryId_idx" ON "SemesterCourse"("catalogEntryId");

-- AddForeignKey
ALTER TABLE "CourseCatalogSource" ADD CONSTRAINT "CourseCatalogSource_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CourseCatalogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SemesterCourse" ADD CONSTRAINT "SemesterCourse_catalogEntryId_fkey" FOREIGN KEY ("catalogEntryId") REFERENCES "CourseCatalogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
