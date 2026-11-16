ALTER TYPE "NotificationType" ADD VALUE 'CONTRIBUTION_SUBMITTED';

CREATE TYPE "ContributionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
CREATE TYPE "ContributionPaymentMethod" AS ENUM ('BANK_TRANSFER', 'MOBILE_MONEY', 'CASH', 'OTHER');

CREATE TABLE "ContributionCampaign" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "publicToken" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "purpose" TEXT NOT NULL DEFAULT 'Apoio ao evento',
  "instructions" TEXT NOT NULL DEFAULT '',
  "proofRequired" BOOLEAN NOT NULL DEFAULT false,
  "allowExpenseSelection" BOOLEAN NOT NULL DEFAULT false,
  "showProgress" BOOLEAN NOT NULL DEFAULT false,
  "goalAmount" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContributionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventContribution" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "contributorName" TEXT,
  "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
  "amount" DECIMAL(14,2) NOT NULL,
  "paymentMethod" "ContributionPaymentMethod" NOT NULL,
  "message" TEXT,
  "proofStorageKey" TEXT,
  "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "expenseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventContribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributionCampaign_projectId_key" ON "ContributionCampaign"("projectId");
CREATE UNIQUE INDEX "ContributionCampaign_publicToken_key" ON "ContributionCampaign"("publicToken");
CREATE INDEX "ContributionCampaign_enabled_publicToken_idx" ON "ContributionCampaign"("enabled", "publicToken");
CREATE INDEX "EventContribution_campaignId_status_createdAt_idx" ON "EventContribution"("campaignId", "status", "createdAt");
CREATE INDEX "EventContribution_expenseId_idx" ON "EventContribution"("expenseId");

ALTER TABLE "ContributionCampaign" ADD CONSTRAINT "ContributionCampaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventContribution" ADD CONSTRAINT "EventContribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContributionCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventContribution" ADD CONSTRAINT "EventContribution_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
