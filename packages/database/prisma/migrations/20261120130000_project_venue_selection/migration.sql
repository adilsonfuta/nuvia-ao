ALTER TABLE "Wedding"
  ADD COLUMN "selectedVenueId" TEXT;

CREATE INDEX "Wedding_selectedVenueId_idx" ON "Wedding"("selectedVenueId");
ALTER TABLE "Wedding"
  ADD CONSTRAINT "Wedding_selectedVenueId_fkey"
  FOREIGN KEY ("selectedVenueId") REFERENCES "Venue"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProjectVenueFavorite" (
  "projectId" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectVenueFavorite_pkey" PRIMARY KEY ("projectId", "venueId")
);

CREATE INDEX "ProjectVenueFavorite_venueId_idx" ON "ProjectVenueFavorite"("venueId");
ALTER TABLE "ProjectVenueFavorite"
  ADD CONSTRAINT "ProjectVenueFavorite_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Wedding"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectVenueFavorite"
  ADD CONSTRAINT "ProjectVenueFavorite_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "Venue"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
