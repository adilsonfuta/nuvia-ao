-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('WEDDING', 'ALAMBAMENTO', 'PARTY', 'OTHER');

-- AlterTable
ALTER TABLE "Wedding" ADD COLUMN     "kind" "ProjectKind" NOT NULL DEFAULT 'WEDDING';

-- Preserve existing projects and infer their primary kind from their first stored moments.
UPDATE "Wedding" AS project
SET "kind" = CASE
  WHEN EXISTS (SELECT 1 FROM "WeddingEvent" AS moment WHERE moment."weddingId" = project."id" AND moment."type" = 'ALAMBAMENTO') THEN 'ALAMBAMENTO'::"ProjectKind"
  WHEN EXISTS (SELECT 1 FROM "WeddingEvent" AS moment WHERE moment."weddingId" = project."id" AND moment."type" = 'RECEPTION') THEN 'PARTY'::"ProjectKind"
  ELSE 'WEDDING'::"ProjectKind"
END;
