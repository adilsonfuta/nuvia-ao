CREATE TYPE "ExpensePaymentStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" "ExpensePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpensePayment_expenseId_status_dueAt_idx" ON "ExpensePayment"("expenseId", "status", "dueAt");
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
