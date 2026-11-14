-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Outros';

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "seatingTableId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assigneeName" TEXT;

-- CreateTable
CREATE TABLE "SeatingTable" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatingTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorFavorite" (
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorFavorite_pkey" PRIMARY KEY ("userId","vendorId")
);

-- CreateIndex
CREATE INDEX "SeatingTable_weddingId_idx" ON "SeatingTable"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatingTable_weddingId_name_key" ON "SeatingTable"("weddingId", "name");

-- CreateIndex
CREATE INDEX "VendorFavorite_vendorId_idx" ON "VendorFavorite"("vendorId");

-- CreateIndex
CREATE INDEX "Guest_seatingTableId_idx" ON "Guest"("seatingTableId");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_seatingTableId_fkey" FOREIGN KEY ("seatingTableId") REFERENCES "SeatingTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingTable" ADD CONSTRAINT "SeatingTable_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorFavorite" ADD CONSTRAINT "VendorFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorFavorite" ADD CONSTRAINT "VendorFavorite_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
