CREATE TYPE "GuestContactChannel" AS ENUM ('WHATSAPP', 'PHONE', 'EMAIL');

ALTER TABLE "GuestRequest"
  ADD COLUMN "contactChannels" "GuestContactChannel"[] NOT NULL DEFAULT ARRAY[]::"GuestContactChannel"[];

UPDATE "GuestRequest"
SET "contactChannels" = CASE
  WHEN "email" IS NOT NULL AND "phone" IS NOT NULL THEN ARRAY['EMAIL', 'PHONE']::"GuestContactChannel"[]
  WHEN "email" IS NOT NULL THEN ARRAY['EMAIL']::"GuestContactChannel"[]
  WHEN "phone" IS NOT NULL THEN ARRAY['PHONE']::"GuestContactChannel"[]
  ELSE ARRAY[]::"GuestContactChannel"[]
END;
