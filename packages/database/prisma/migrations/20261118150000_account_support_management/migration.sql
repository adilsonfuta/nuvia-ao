ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT';

CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

ALTER TABLE "User"
  ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspensionReason" TEXT,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

UPDATE "User" AS account
SET "lastLoginAt" = sessions."lastLoginAt"
FROM (
  SELECT "userId", MAX("createdAt") AS "lastLoginAt"
  FROM "Session"
  GROUP BY "userId"
) AS sessions
WHERE account."id" = sessions."userId";

CREATE TABLE "SupportRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "requesterName" TEXT,
  "requesterEmail" TEXT,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
  "response" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRequest_status_updatedAt_idx" ON "SupportRequest"("status", "updatedAt");
CREATE INDEX "SupportRequest_userId_createdAt_idx" ON "SupportRequest"("userId", "createdAt");

ALTER TABLE "SupportRequest"
  ADD CONSTRAINT "SupportRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
