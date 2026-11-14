CREATE TYPE "VendorContentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "VendorClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Vendor"
  ADD COLUMN "websiteUrl" TEXT,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "facebookUrl" TEXT,
  ADD COLUMN "tiktokUrl" TEXT,
  ADD COLUMN "ownerUserId" TEXT;

CREATE INDEX "Vendor_ownerUserId_idx" ON "Vendor"("ownerUserId");
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VendorClaim" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "VendorClaimStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  CONSTRAINT "VendorClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VendorClaim_vendorId_userId_key" ON "VendorClaim"("vendorId", "userId");
CREATE INDEX "VendorClaim_status_createdAt_idx" ON "VendorClaim"("status", "createdAt");
ALTER TABLE "VendorClaim" ADD CONSTRAINT "VendorClaim_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorClaim" ADD CONSTRAINT "VendorClaim_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorClaim" ADD CONSTRAINT "VendorClaim_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VendorPortfolioItem" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "altText" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "status" "VendorContentStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "uploadedBy" TEXT,
  "reviewedBy" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "VendorPortfolioItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VendorPortfolioItem_storageKey_key" ON "VendorPortfolioItem"("storageKey");
CREATE INDEX "VendorPortfolioItem_vendorId_status_sortOrder_idx" ON "VendorPortfolioItem"("vendorId", "status", "sortOrder");
ALTER TABLE "VendorPortfolioItem" ADD CONSTRAINT "VendorPortfolioItem_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorPortfolioItem" ADD CONSTRAINT "VendorPortfolioItem_uploadedBy_fkey"
  FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorPortfolioItem" ADD CONSTRAINT "VendorPortfolioItem_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VendorProfileSubmission" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "submittedBy" TEXT,
  "reviewedBy" TEXT,
  "payload" JSONB NOT NULL,
  "status" "VendorContentStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "VendorProfileSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VendorProfileSubmission_vendorId_status_createdAt_idx" ON "VendorProfileSubmission"("vendorId", "status", "createdAt");
ALTER TABLE "VendorProfileSubmission" ADD CONSTRAINT "VendorProfileSubmission_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorProfileSubmission" ADD CONSTRAINT "VendorProfileSubmission_submittedBy_fkey"
  FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorProfileSubmission" ADD CONSTRAINT "VendorProfileSubmission_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
