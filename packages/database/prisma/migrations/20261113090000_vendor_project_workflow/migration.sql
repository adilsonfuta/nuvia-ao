-- Add explicit states for manually tracked quote requests.
ALTER TYPE "QuoteRequestStatus" ADD VALUE 'SENT';
ALTER TYPE "QuoteRequestStatus" ADD VALUE 'HIRED';

ALTER TABLE "QuoteRequest"
  ADD COLUMN "quotedAmount" DECIMAL(14,2),
  ADD COLUMN "responseNote" TEXT,
  ADD COLUMN "respondedAt" TIMESTAMP(3);

CREATE TABLE "ProjectVendorFavorite" (
  "projectId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectVendorFavorite_pkey" PRIMARY KEY ("projectId", "vendorId")
);

CREATE INDEX "ProjectVendorFavorite_vendorId_idx" ON "ProjectVendorFavorite"("vendorId");

ALTER TABLE "ProjectVendorFavorite"
  ADD CONSTRAINT "ProjectVendorFavorite_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectVendorFavorite_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense" ADD COLUMN "quoteRequestId" TEXT;
CREATE UNIQUE INDEX "Expense_quoteRequestId_key" ON "Expense"("quoteRequestId");
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_quoteRequestId_fkey"
  FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
