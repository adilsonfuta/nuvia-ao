-- CreateEnum
CREATE TYPE "VendorReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX IF EXISTS "Vendor_ownerUserId_idx";

-- CreateTable
CREATE TABLE "VendorReview" (
    "id" TEXT NOT NULL,
    "quoteRequestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "rating" INTEGER NOT NULL,
    "communicationRating" INTEGER NOT NULL,
    "punctualityRating" INTEGER NOT NULL,
    "qualityRating" INTEGER NOT NULL,
    "comment" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "status" "VendorReviewStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "response" TEXT,
    "responseStatus" "VendorContentStatus",
    "responseReason" TEXT,
    "responseBy" TEXT,
    "responseAt" TIMESTAMP(3),
    "responseReviewedAt" TIMESTAMP(3),
    "responseReviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorReview_quoteRequestId_key" ON "VendorReview"("quoteRequestId");

-- CreateIndex
CREATE INDEX "VendorReview_vendorId_status_createdAt_idx" ON "VendorReview"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "VendorReview_responseStatus_createdAt_idx" ON "VendorReview"("responseStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "VendorReview" ADD CONSTRAINT "VendorReview_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReview" ADD CONSTRAINT "VendorReview_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReview" ADD CONSTRAINT "VendorReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReview" ADD CONSTRAINT "VendorReview_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReview" ADD CONSTRAINT "VendorReview_responseBy_fkey" FOREIGN KEY ("responseBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorReview" ADD CONSTRAINT "VendorReview_responseReviewedBy_fkey" FOREIGN KEY ("responseReviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
