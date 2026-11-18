CREATE TYPE "ProjectDocumentStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'READY', 'NOT_REQUIRED');

CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Documentação',
    "status" "ProjectDocumentStatus" NOT NULL DEFAULT 'TODO',
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "assigneeName" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "fileUploadedAt" TIMESTAMP(3),
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectDocument_storageKey_key" ON "ProjectDocument"("storageKey");
CREATE INDEX "ProjectDocument_projectId_status_updatedAt_idx" ON "ProjectDocument"("projectId", "status", "updatedAt");
CREATE INDEX "ProjectDocument_assigneeName_idx" ON "ProjectDocument"("assigneeName");

ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
