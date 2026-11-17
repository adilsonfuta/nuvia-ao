-- Existing requests predate unread tracking; avoid showing the entire legacy inbox as new.
UPDATE "QuoteRequest" SET "vendorViewedAt" = "createdAt" WHERE "vendorViewedAt" IS NULL;
