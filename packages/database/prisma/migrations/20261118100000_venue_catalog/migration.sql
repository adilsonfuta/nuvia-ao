CREATE TYPE "VenueStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'SUSPENDED');

CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venueType" TEXT NOT NULL,
    "description" TEXT,
    "province" TEXT,
    "municipality" TEXT,
    "address" TEXT,
    "mapsUrl" TEXT,
    "capacityMin" INTEGER,
    "capacityMax" INTEGER,
    "priceFrom" DECIMAL(14,2),
    "priceTo" DECIMAL(14,2),
    "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "eventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "galleryUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "phone" TEXT,
    "email" TEXT,
    "websiteUrl" TEXT,
    "bookingTerms" TEXT,
    "paymentTerms" TEXT,
    "cancellationTerms" TEXT,
    "status" "VenueStatus" NOT NULL DEFAULT 'DRAFT',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");
CREATE INDEX "Venue_status_province_venueType_idx" ON "Venue"("status", "province", "venueType");
CREATE INDEX "Venue_capacityMax_idx" ON "Venue"("capacityMax");

ALTER TABLE "Venue" ADD CONSTRAINT "Venue_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
