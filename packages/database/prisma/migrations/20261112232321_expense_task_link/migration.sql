-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "taskId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_taskId_idx" ON "Expense"("taskId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
