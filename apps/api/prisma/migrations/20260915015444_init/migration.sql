-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('LECTURE', 'REVIEW', 'ASSIGNMENT', 'PROJECT', 'EXAM_PREP', 'PRACTICE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('CRITICAL', 'IMPORTANT', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "LectureState" AS ENUM ('TAKEN_NOT_STUDIED', 'STUDIED', 'NEEDS_REVIEW', 'MASTERED');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'READY_TO_SUBMIT', 'SUBMITTED', 'GRADED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('QUIZ', 'MIDTERM', 'FINAL');

-- CreateEnum
CREATE TYPE "PreparationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('QUIZ', 'ASSIGNMENT', 'PROJECT', 'MIDTERM', 'FINAL', 'PARTICIPATION', 'OTHER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('FIRST_REVIEW', 'WEEKLY_REVIEW', 'WEAK_TOPIC_REVIEW', 'EXAM_REVIEW');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('ON_TRACK', 'NEEDS_ATTENTION', 'AT_RISK');

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "creditHours" INTEGER NOT NULL,
    "targetGrade" TEXT NOT NULL DEFAULT 'B+',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "retake" BOOLEAN NOT NULL DEFAULT false,
    "previousGrade" DOUBLE PRECISION,
    "replacementEffect" BOOLEAN NOT NULL DEFAULT false,
    "targetGrade" TEXT NOT NULL DEFAULT 'B+',
    "specialNote" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'ON_TRACK',
    "lastStudyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversitySchedule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,

    CONSTRAINT "UniversitySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "lectureDate" TIMESTAMP(3) NOT NULL,
    "takenAtUniversity" BOOLEAN NOT NULL DEFAULT true,
    "state" "LectureState" NOT NULL DEFAULT 'TAKEN_NOT_STUDIED',
    "understandingScore" INTEGER,
    "notes" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "studiedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "masteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyTask" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lectureId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "TaskType" NOT NULL,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'IMPORTANT',
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "priorityReason" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueAt" TIMESTAMP(3),
    "estimatedEffort" INTEGER,
    "source" TEXT,
    "notes" TEXT,
    "deferredCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "releaseDate" TIMESTAMP(3),
    "officialDeadline" TIMESTAMP(3) NOT NULL,
    "internalDeadline" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "status" "WorkStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'IMPORTANT',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "grade" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "officialDeadline" TIMESTAMP(3) NOT NULL,
    "internalDeadline" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "status" "ProjectStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "order" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "type" "ExamType" NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "coveredLectures" INTEGER[],
    "coveredTopics" TEXT[],
    "notes" TEXT,
    "preparationStatus" "PreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "preparationStartAt" TIMESTAMP(3),
    "confidenceLevel" INTEGER,
    "weight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "assessmentType" "AssessmentType" NOT NULL,
    "title" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maximumScore" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeakTopic" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "lastReviewedAt" TIMESTAMP(3),
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeakTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lectureId" TEXT,
    "weakTopicId" TEXT,
    "type" "ReviewType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCheckOut" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TEXT,
    "misunderstoodTopics" TEXT[],
    "notes" TEXT,
    "selfRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCheckOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL,
    "completionPercentage" INTEGER NOT NULL,
    "backlogState" TEXT NOT NULL,
    "keyRisks" TEXT[],
    "nextWeekPriorities" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyCourseCoverage" (
    "id" TEXT NOT NULL,
    "weeklyReviewId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "covered" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WeeklyCourseCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'settings',
    "language" TEXT NOT NULL DEFAULT 'ar',
    "weeklyReviewDay" INTEGER NOT NULL DEFAULT 6,
    "defaultTarget" TEXT NOT NULL DEFAULT 'B+',
    "retakeBonus" INTEGER NOT NULL DEFAULT 8,
    "firstReviewHours" INTEGER NOT NULL DEFAULT 24,
    "focusModeManual" BOOLEAN,
    "focusModeReason" TEXT,
    "priorityWeights" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Semester_isCurrent_idx" ON "Semester"("isCurrent");

-- CreateIndex
CREATE INDEX "Course_semesterId_status_idx" ON "Course"("semesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Course_semesterId_code_key" ON "Course"("semesterId", "code");

-- CreateIndex
CREATE INDEX "UniversitySchedule_dayOfWeek_startsAt_idx" ON "UniversitySchedule"("dayOfWeek", "startsAt");

-- CreateIndex
CREATE INDEX "Lecture_courseId_state_idx" ON "Lecture"("courseId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Lecture_courseId_number_key" ON "Lecture"("courseId", "number");

-- CreateIndex
CREATE INDEX "StudyTask_status_dueAt_idx" ON "StudyTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "StudyTask_courseId_priorityScore_idx" ON "StudyTask"("courseId", "priorityScore");

-- CreateIndex
CREATE INDEX "Assignment_status_officialDeadline_idx" ON "Assignment"("status", "officialDeadline");

-- CreateIndex
CREATE INDEX "Assignment_courseId_idx" ON "Assignment"("courseId");

-- CreateIndex
CREATE INDEX "Project_status_officialDeadline_idx" ON "Project"("status", "officialDeadline");

-- CreateIndex
CREATE INDEX "Project_courseId_idx" ON "Project"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMilestone_projectId_order_key" ON "ProjectMilestone"("projectId", "order");

-- CreateIndex
CREATE INDEX "Exam_date_preparationStatus_idx" ON "Exam"("date", "preparationStatus");

-- CreateIndex
CREATE INDEX "Exam_courseId_idx" ON "Exam"("courseId");

-- CreateIndex
CREATE INDEX "Grade_courseId_date_idx" ON "Grade"("courseId", "date");

-- CreateIndex
CREATE INDEX "WeakTopic_courseId_resolved_severity_idx" ON "WeakTopic"("courseId", "resolved", "severity");

-- CreateIndex
CREATE INDEX "Review_scheduledAt_completedAt_idx" ON "Review"("scheduledAt", "completedAt");

-- CreateIndex
CREATE INDEX "Review_courseId_idx" ON "Review"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCheckOut_date_key" ON "DailyCheckOut"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_weekStart_key" ON "WeeklyReview"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCourseCoverage_weeklyReviewId_courseId_key" ON "WeeklyCourseCoverage"("weeklyReviewId", "courseId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversitySchedule" ADD CONSTRAINT "UniversitySchedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lecture" ADD CONSTRAINT "Lecture_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyTask" ADD CONSTRAINT "StudyTask_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeakTopic" ADD CONSTRAINT "WeakTopic_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_weakTopicId_fkey" FOREIGN KEY ("weakTopicId") REFERENCES "WeakTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCourseCoverage" ADD CONSTRAINT "WeeklyCourseCoverage_weeklyReviewId_fkey" FOREIGN KEY ("weeklyReviewId") REFERENCES "WeeklyReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCourseCoverage" ADD CONSTRAINT "WeeklyCourseCoverage_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
