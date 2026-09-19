ALTER TABLE "Course"
ADD COLUMN "assessmentTypes" "AssessmentType"[] NOT NULL DEFAULT ARRAY[]::"AssessmentType"[];
