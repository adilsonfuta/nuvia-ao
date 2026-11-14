CREATE TYPE "VendorApplicationStatus" AS ENUM ('NEW', 'CONTACTED', 'DECLINED', 'CONVERTED');

CREATE TABLE "VendorApplication" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "municipality" TEXT,
    "website" TEXT,
    "message" TEXT NOT NULL,
    "status" "VendorApplicationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "vendorId" TEXT,
    CONSTRAINT "VendorApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorApplication_vendorId_key" ON "VendorApplication"("vendorId");
CREATE INDEX "VendorApplication_status_createdAt_idx" ON "VendorApplication"("status", "createdAt");
CREATE INDEX "VendorApplication_email_idx" ON "VendorApplication"("email");

ALTER TABLE "VendorApplication"
  ADD CONSTRAINT "VendorApplication_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
