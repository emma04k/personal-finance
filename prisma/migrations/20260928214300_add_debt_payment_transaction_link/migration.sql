-- AlterTable
ALTER TABLE "DebtPayment" ADD COLUMN "transactionId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_id_userId_key" ON "Transaction"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_transactionId_key" ON "DebtPayment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_transactionId_userId_key" ON "DebtPayment"("transactionId", "userId");

-- CreateIndex
CREATE INDEX "DebtPayment_userId_transactionId_idx" ON "DebtPayment"("userId", "transactionId");

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_transactionId_userId_fkey" FOREIGN KEY ("transactionId", "userId") REFERENCES "Transaction"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
