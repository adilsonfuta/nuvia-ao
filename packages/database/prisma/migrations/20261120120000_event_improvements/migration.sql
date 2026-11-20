CREATE TYPE "AvailabilityStatus" AS ENUM ('PENDING', 'AVAILABLE', 'UNAVAILABLE', 'ALTERNATIVE_PROPOSED');
CREATE TYPE "AlbumPhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "weeklyDigestLastStatus" TEXT,
  ADD COLUMN "weeklyDigestLastError" TEXT,
  ADD COLUMN "weeklyDigestLastAttemptAt" TIMESTAMP(3);

ALTER TABLE "QuoteRequest"
  ADD COLUMN "eventDate" TIMESTAMP(3),
  ADD COLUMN "partySize" INTEGER,
  ADD COLUMN "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "Guest"
  ADD COLUMN "invitationEmailStatus" TEXT,
  ADD COLUMN "invitationEmailError" TEXT,
  ADD COLUMN "invitationEmailAttemptedAt" TIMESTAMP(3);

CREATE TABLE "VenueInquiry" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "eventDate" TIMESTAMP(3),
  "partySize" INTEGER,
  "message" TEXT NOT NULL,
  "status" "QuoteRequestStatus" NOT NULL DEFAULT 'NEW',
  "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'PENDING',
  "quotedAmount" DECIMAL(14,2),
  "responseNote" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VenueInquiry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VenueInquiry_venueId_status_createdAt_idx" ON "VenueInquiry"("venueId", "status", "createdAt");
CREATE INDEX "VenueInquiry_userId_createdAt_idx" ON "VenueInquiry"("userId", "createdAt");
ALTER TABLE "VenueInquiry" ADD CONSTRAINT "VenueInquiry_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueInquiry" ADD CONSTRAINT "VenueInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VenueInquiry" ADD CONSTRAINT "VenueInquiry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Wedding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EventAlbum" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "publicToken" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventAlbum_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventAlbum_projectId_key" ON "EventAlbum"("projectId");
CREATE UNIQUE INDEX "EventAlbum_publicToken_key" ON "EventAlbum"("publicToken");
ALTER TABLE "EventAlbum" ADD CONSTRAINT "EventAlbum_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventAlbumPhoto" (
  "id" TEXT NOT NULL,
  "albumId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "uploaderName" TEXT,
  "status" "AlbumPhotoStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventAlbumPhoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventAlbumPhoto_storageKey_key" ON "EventAlbumPhoto"("storageKey");
CREATE INDEX "EventAlbumPhoto_albumId_status_createdAt_idx" ON "EventAlbumPhoto"("albumId", "status", "createdAt");
ALTER TABLE "EventAlbumPhoto" ADD CONSTRAINT "EventAlbumPhoto_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "EventAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
