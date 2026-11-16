ALTER TABLE "Guest" RENAME COLUMN "rsvpToken" TO "rsvpTokenLegacy";
ALTER INDEX "Guest_rsvpToken_key" RENAME TO "Guest_rsvpTokenLegacy_key";
ALTER TABLE "Guest" ADD COLUMN "rsvpTokenHash" TEXT;
ALTER TABLE "Guest" ADD COLUMN "rsvpTokenCiphertext" TEXT;
CREATE UNIQUE INDEX "Guest_rsvpTokenHash_key" ON "Guest"("rsvpTokenHash");
ALTER TABLE "Guest" ADD COLUMN "rsvpTokenPreviousHash" TEXT;
ALTER TABLE "Guest" ADD COLUMN "rsvpTokenPreviousExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Guest_rsvpTokenPreviousHash_key" ON "Guest"("rsvpTokenPreviousHash");
