-- Additive authentication and security hardening. Existing academic tables are unchanged.
ALTER TABLE "User"
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TwoFactor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityAuditLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TwoFactor_userId_key" ON "TwoFactor"("userId");
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");
CREATE INDEX "RateLimit_lastRequest_idx" ON "RateLimit"("lastRequest");
CREATE INDEX "SecurityAuditLog_actorUserId_createdAt_idx" ON "SecurityAuditLog"("actorUserId", "createdAt");
CREATE INDEX "SecurityAuditLog_event_createdAt_idx" ON "SecurityAuditLog"("event", "createdAt");

ALTER TABLE "TwoFactor"
ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SecurityAuditLog"
ADD CONSTRAINT "SecurityAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
