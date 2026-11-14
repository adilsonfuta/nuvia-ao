-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "bookingTerms" TEXT,
ADD COLUMN     "cancellationTerms" TEXT,
ADD COLUMN     "capacityMax" INTEGER,
ADD COLUMN     "capacityMin" INTEGER,
ADD COLUMN     "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "services" TEXT[] DEFAULT ARRAY[]::TEXT[];
