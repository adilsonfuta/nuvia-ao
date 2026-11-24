ALTER TABLE "RSVP"
  ADD COLUMN "confirmationEmailStatus" TEXT,
  ADD COLUMN "confirmationEmailError" TEXT,
  ADD COLUMN "confirmationEmailAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "confirmationEmailSentAt" TIMESTAMP(3);
