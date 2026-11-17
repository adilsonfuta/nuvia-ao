ALTER TABLE "QuoteRequest" ADD COLUMN "vendorViewedAt" TIMESTAMP(3);
CREATE INDEX "QuoteRequest_vendorId_vendorViewedAt_idx" ON "QuoteRequest"("vendorId", "vendorViewedAt");
