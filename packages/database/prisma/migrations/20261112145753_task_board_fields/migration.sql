-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'WAITING';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Planeamento',
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL';
