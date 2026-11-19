ALTER TABLE "User"
  ADD COLUMN "lastLoginAgentHash" TEXT,
  ADD COLUMN "emailEventNotifications" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "weeklyDigestLastSentAt" TIMESTAMP(3),
  ADD COLUMN "weeklyDigestClaimedAt" TIMESTAMP(3);
ALTER TABLE "Guest" ADD COLUMN "invitationSentAt" TIMESTAMP(3);
ALTER TABLE "EventContribution" ADD COLUMN "contributorEmail" TEXT;
CREATE TABLE "EmailChangeToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "newEmail" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailChangeToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailChangeToken_tokenHash_key" ON "EmailChangeToken"("tokenHash");
CREATE INDEX "EmailChangeToken_userId_expiresAt_idx" ON "EmailChangeToken"("userId", "expiresAt");
ALTER TABLE "EmailChangeToken" ADD CONSTRAINT "EmailChangeToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
