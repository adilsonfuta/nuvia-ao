CREATE TYPE "GuestRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

ALTER TABLE "Invitation"
  ADD COLUMN "allowGuestRequests" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "GuestRequest" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "partySize" INTEGER NOT NULL DEFAULT 1,
  "requestedRsvp" "RsvpStatus" NOT NULL DEFAULT 'ACCEPTED',
  "note" TEXT,
  "status" "GuestRequestStatus" NOT NULL DEFAULT 'PENDING',
  "guestId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuestRequest_guestId_key" ON "GuestRequest"("guestId");
CREATE INDEX "GuestRequest_projectId_status_createdAt_idx" ON "GuestRequest"("projectId", "status", "createdAt");
CREATE INDEX "GuestRequest_invitationId_email_idx" ON "GuestRequest"("invitationId", "email");
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestRequest" ADD CONSTRAINT "GuestRequest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
