-- The renamed legacy token column keeps its original NOT NULL constraint.
-- Token rotation clears it after storing the encrypted replacement.
ALTER TABLE "Guest" ALTER COLUMN "rsvpTokenLegacy" DROP NOT NULL;
