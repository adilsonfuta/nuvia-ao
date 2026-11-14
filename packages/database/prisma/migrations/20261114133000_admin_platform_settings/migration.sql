CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "PlatformSetting_updatedBy_idx" ON "PlatformSetting"("updatedBy");

ALTER TABLE "PlatformSetting"
ADD CONSTRAINT "PlatformSetting_updatedBy_fkey"
FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
