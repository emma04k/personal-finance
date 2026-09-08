-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE', 'SAVINGS', 'DEBT_PAYMENT');

-- CreateEnum
CREATE TYPE "BudgetLineKind" AS ENUM ('PLANNED', 'ACTUAL');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'CLOSED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImportJobType" AS ENUM ('WORKBOOK');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'AUTHENTICATE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "displayName" VARCHAR(120),
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OidcAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "providerAccountId" VARCHAR(191) NOT NULL,
    "issuer" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OidcAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "timeZone" VARCHAR(64) NOT NULL,
    "locale" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "monthStart" DATE NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "timeZone" VARCHAR(64) NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "CategoryType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "kind" "BudgetLineKind" NOT NULL DEFAULT 'PLANNED',
    "plannedAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "actualAmountMinor" BIGINT,
    "currencyCode" VARCHAR(3) NOT NULL,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "categoryId" UUID,
    "importJobId" UUID,
    "direction" "TransactionDirection" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "notes" VARCHAR(500),
    "externalId" VARCHAR(191),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringRule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "categoryId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "startOn" DATE NOT NULL,
    "nextDueOn" DATE NOT NULL,
    "endOn" DATE,
    "status" "RuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "creditorName" VARCHAR(120),
    "currencyCode" VARCHAR(3) NOT NULL,
    "openingBalanceMinor" BIGINT NOT NULL,
    "currentBalanceMinor" BIGINT NOT NULL,
    "defaultRequiredPaymentMinor" BIGINT NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "openedOn" DATE,
    "closedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "debtAccountId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "currencyCode" VARCHAR(3) NOT NULL,
    "paidOn" DATE,
    "requiredPaymentOverrideMinor" BIGINT,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "targetAmountMinor" BIGINT NOT NULL,
    "currentAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "currencyCode" VARCHAR(3) NOT NULL,
    "targetDate" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ImportJobType" NOT NULL DEFAULT 'WORKBOOK',
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" VARCHAR(255) NOT NULL,
    "sourceHash" VARCHAR(128),
    "currencyCode" VARCHAR(3) NOT NULL,
    "timeZone" VARCHAR(64) NOT NULL,
    "errorMessage" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "actorUserId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(191) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OidcAccount_userId_idx" ON "OidcAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OidcAccount_provider_providerAccountId_key" ON "OidcAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "Period_userId_idx" ON "Period"("userId");

-- CreateIndex
CREATE INDEX "Period_userId_monthStart_idx" ON "Period"("userId", "monthStart");

-- CreateIndex
CREATE UNIQUE INDEX "Period_userId_monthStart_key" ON "Period"("userId", "monthStart");

-- CreateIndex
CREATE UNIQUE INDEX "Period_id_userId_key" ON "Period"("id", "userId");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "Category_userId_type_idx" ON "Category"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_type_name_key" ON "Category"("userId", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_id_userId_key" ON "Category"("id", "userId");

-- CreateIndex
CREATE INDEX "BudgetLine_userId_idx" ON "BudgetLine"("userId");

-- CreateIndex
CREATE INDEX "BudgetLine_userId_periodId_idx" ON "BudgetLine"("userId", "periodId");

-- CreateIndex
CREATE INDEX "BudgetLine_userId_categoryId_idx" ON "BudgetLine"("userId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_periodId_categoryId_key" ON "BudgetLine"("periodId", "categoryId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_occurredOn_idx" ON "Transaction"("userId", "occurredOn");

-- CreateIndex
CREATE INDEX "Transaction_userId_periodId_idx" ON "Transaction"("userId", "periodId");

-- CreateIndex
CREATE INDEX "Transaction_userId_categoryId_idx" ON "Transaction"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "Transaction_userId_importJobId_idx" ON "Transaction"("userId", "importJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_externalId_key" ON "Transaction"("userId", "externalId");

-- CreateIndex
CREATE INDEX "RecurringRule_userId_idx" ON "RecurringRule"("userId");

-- CreateIndex
CREATE INDEX "RecurringRule_userId_status_nextDueOn_idx" ON "RecurringRule"("userId", "status", "nextDueOn");

-- CreateIndex
CREATE INDEX "RecurringRule_userId_categoryId_idx" ON "RecurringRule"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "DebtAccount_userId_idx" ON "DebtAccount"("userId");

-- CreateIndex
CREATE INDEX "DebtAccount_userId_status_idx" ON "DebtAccount"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DebtAccount_userId_name_key" ON "DebtAccount"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DebtAccount_id_userId_key" ON "DebtAccount"("id", "userId");

-- CreateIndex
CREATE INDEX "DebtPayment_userId_idx" ON "DebtPayment"("userId");

-- CreateIndex
CREATE INDEX "DebtPayment_userId_periodId_idx" ON "DebtPayment"("userId", "periodId");

-- CreateIndex
CREATE INDEX "DebtPayment_userId_debtAccountId_idx" ON "DebtPayment"("userId", "debtAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtPayment_periodId_debtAccountId_key" ON "DebtPayment"("periodId", "debtAccountId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_status_idx" ON "Goal"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_userId_name_key" ON "Goal"("userId", "name");

-- CreateIndex
CREATE INDEX "ImportJob_userId_idx" ON "ImportJob"("userId");

-- CreateIndex
CREATE INDEX "ImportJob_userId_status_createdAt_idx" ON "ImportJob"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportJob_id_userId_key" ON "ImportJob"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportJob_userId_sourceHash_key" ON "ImportJob"("userId", "sourceHash");

-- CreateIndex
CREATE INDEX "AuditEvent_ownerUserId_createdAt_idx" ON "AuditEvent"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "OidcAccount" ADD CONSTRAINT "OidcAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_periodId_userId_fkey" FOREIGN KEY ("periodId", "userId") REFERENCES "Period"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "Category"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_periodId_userId_fkey" FOREIGN KEY ("periodId", "userId") REFERENCES "Period"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "Category"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importJobId_userId_fkey" FOREIGN KEY ("importJobId", "userId") REFERENCES "ImportJob"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "Category"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtAccount" ADD CONSTRAINT "DebtAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_periodId_userId_fkey" FOREIGN KEY ("periodId", "userId") REFERENCES "Period"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtAccountId_userId_fkey" FOREIGN KEY ("debtAccountId", "userId") REFERENCES "DebtAccount"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_plannedAmountMinor_non_negative" CHECK ("plannedAmountMinor" >= 0);
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_actualAmountMinor_non_negative" CHECK ("actualAmountMinor" IS NULL OR "actualAmountMinor" >= 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amountMinor_non_negative" CHECK ("amountMinor" >= 0);
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_amountMinor_non_negative" CHECK ("amountMinor" >= 0);
ALTER TABLE "DebtAccount" ADD CONSTRAINT "DebtAccount_openingBalanceMinor_non_negative" CHECK ("openingBalanceMinor" >= 0);
ALTER TABLE "DebtAccount" ADD CONSTRAINT "DebtAccount_currentBalanceMinor_non_negative" CHECK ("currentBalanceMinor" >= 0);
ALTER TABLE "DebtAccount" ADD CONSTRAINT "DebtAccount_defaultRequiredPaymentMinor_non_negative" CHECK ("defaultRequiredPaymentMinor" >= 0);
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_amountMinor_non_negative" CHECK ("amountMinor" >= 0);
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_requiredPaymentOverrideMinor_non_negative" CHECK ("requiredPaymentOverrideMinor" IS NULL OR "requiredPaymentOverrideMinor" >= 0);
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_targetAmountMinor_non_negative" CHECK ("targetAmountMinor" >= 0);
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_currentAmountMinor_non_negative" CHECK ("currentAmountMinor" >= 0);
