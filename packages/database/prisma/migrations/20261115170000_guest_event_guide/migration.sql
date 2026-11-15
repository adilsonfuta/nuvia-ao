ALTER TABLE "WeddingEvent"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "mapsUrl" TEXT,
  ADD COLUMN "guestNotes" TEXT,
  ADD COLUMN "showToGuests" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Invitation"
  ADD COLUMN "publicNotes" TEXT,
  ADD COLUMN "dressCode" TEXT,
  ADD COLUMN "supportContactName" TEXT,
  ADD COLUMN "supportContactPhone" TEXT;
