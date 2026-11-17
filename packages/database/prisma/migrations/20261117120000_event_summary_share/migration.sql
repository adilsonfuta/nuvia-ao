CREATE TABLE "EventSummaryShare" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "showFinancial" BOOLEAN NOT NULL DEFAULT false,
    "showGuestCounts" BOOLEAN NOT NULL DEFAULT true,
    "showVendors" BOOLEAN NOT NULL DEFAULT false,
    "showCompletedTasks" BOOLEAN NOT NULL DEFAULT true,
    "showProgram" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventSummaryShare_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventSummaryShare_projectId_key" ON "EventSummaryShare"("projectId");
CREATE UNIQUE INDEX "EventSummaryShare_publicToken_key" ON "EventSummaryShare"("publicToken");
CREATE INDEX "EventSummaryShare_enabled_publicToken_idx" ON "EventSummaryShare"("enabled", "publicToken");
ALTER TABLE "EventSummaryShare" ADD CONSTRAINT "EventSummaryShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
