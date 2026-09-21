CREATE TYPE "LectureDeliveryMode" AS ENUM ('IN_PERSON', 'ONLINE');

ALTER TABLE "Lecture"
  ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "deliveryMode" "LectureDeliveryMode" NOT NULL DEFAULT 'IN_PERSON',
  ADD COLUMN "attended" BOOLEAN NOT NULL DEFAULT false;
