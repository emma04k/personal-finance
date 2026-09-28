import type {
  CreateDebtPaymentForOwnerInput,
  OwnedDebtPayment,
  OwnedDebtPaymentAccount,
  OwnedDebtPaymentHistoryEntry,
  OwnedDebtPaymentLinkedTransaction,
  OwnedDebtPaymentPeriod,
  OwnedDebtPaymentRepository,
  OwnedDebtPaymentTransactionCandidate,
} from "@/modules/debt/application/owned-debt-payment-repository";
import {
  DuplicateDebtPaymentError,
  DuplicateDebtPaymentTransactionLinkError,
} from "@/modules/debt/application/owned-debt-payment-repository";

type PrismaDebtPaymentRecord = Omit<OwnedDebtPayment,
  "amountMinor" | "paidOn" | "requiredPaymentOverrideMinor" | "linkedTransactionId"
> & {
  readonly transactionId: string | null;
  readonly amountMinor: bigint | number | string;
  readonly paidOn: Date | string | null;
  readonly requiredPaymentOverrideMinor: bigint | number | string | null;
};

type PrismaDebtPaymentHistoryRecord = {
  readonly id: string;
  readonly amountMinor: bigint | number | string;
  readonly currencyCode: string;
  readonly paidOn: Date | string | null;
  readonly requiredPaymentOverrideMinor: bigint | number | string | null;
  readonly notes: string | null;
  readonly debtAccount: { readonly name: string };
  readonly period: { readonly monthStart: Date | string };
  readonly linkedTransaction: null | {
    readonly id: string;
    readonly occurredOn: Date | string;
    readonly description: string;
    readonly amountMinor: bigint | number | string;
    readonly currencyCode: string;
  };
};

type PrismaDebtPaymentTransactionCandidateRecord = {
  readonly id: string;
  readonly periodId: string;
  readonly occurredOn: Date | string;
  readonly description: string;
  readonly amountMinor: bigint | number | string;
  readonly currencyCode: string;
  readonly category: null | { readonly name: string; readonly type: "INCOME" | "EXPENSE" | "SAVINGS" | "DEBT_PAYMENT" };
};

type PrismaDebtPaymentLinkedTransactionRecord = {
  readonly id: string;
  readonly userId: string;
  readonly periodId: string;
  readonly direction: "INFLOW" | "OUTFLOW";
  readonly amountMinor: bigint | number | string;
  readonly currencyCode: string;
  readonly category: null | { readonly type: "INCOME" | "EXPENSE" | "SAVINGS" | "DEBT_PAYMENT" };
  readonly linkedDebtPayment: null | { readonly id: string };
};

type PrismaDelegateMethod = (args: never) => Promise<unknown>;

type DebtPaymentPrismaClient = {
  readonly debtAccount: {
    readonly findFirst: PrismaDelegateMethod;
    readonly updateMany?: PrismaDelegateMethod;
  };
  readonly period: {
    readonly findFirst: PrismaDelegateMethod;
  };
  readonly debtPayment: {
    readonly create: PrismaDelegateMethod;
    readonly findMany: PrismaDelegateMethod;
  };
  readonly transaction?: {
    readonly findMany: PrismaDelegateMethod;
    readonly findFirst: PrismaDelegateMethod;
  };
};

function toOwnedDebtPaymentHistoryEntry(record: PrismaDebtPaymentHistoryRecord): OwnedDebtPaymentHistoryEntry {
  return {
    id: record.id,
    accountLabel: record.debtAccount.name,
    periodMonthStart: toDateOnlyString(record.period.monthStart),
    amountMinor: record.amountMinor.toString(),
    currencyCode: record.currencyCode,
    paidOn: toDateOnlyString(record.paidOn),
    requiredPaymentOverrideMinor: record.requiredPaymentOverrideMinor?.toString() ?? null,
    notes: record.notes,
    linkedTransaction: record.linkedTransaction
      ? {
          id: record.linkedTransaction.id,
          occurredOn: toDateOnlyString(record.linkedTransaction.occurredOn),
          description: record.linkedTransaction.description,
          amountMinor: record.linkedTransaction.amountMinor.toString(),
          currencyCode: record.linkedTransaction.currencyCode,
        }
      : null,
  };
}

function toOwnedTransactionCandidate(
  record: PrismaDebtPaymentTransactionCandidateRecord,
): OwnedDebtPaymentTransactionCandidate {
  return {
    id: record.id,
    periodId: record.periodId,
    occurredOn: toDateOnlyString(record.occurredOn),
    description: record.description,
    amountMinor: record.amountMinor.toString(),
    currencyCode: record.currencyCode,
    categoryName: record.category?.name ?? null,
  };
}

function toOwnedLinkedTransaction(
  record: PrismaDebtPaymentLinkedTransactionRecord,
): OwnedDebtPaymentLinkedTransaction {
  return {
    id: record.id,
    userId: record.userId,
    periodId: record.periodId,
    direction: record.direction,
    amountMinor: record.amountMinor.toString(),
    currencyCode: record.currencyCode,
    categoryType: record.category?.type ?? null,
    linkedDebtPaymentId: record.linkedDebtPayment?.id ?? null,
  };
}

const debtPaymentHistorySelect = {
  id: true,
  amountMinor: true,
  currencyCode: true,
  paidOn: true,
  requiredPaymentOverrideMinor: true,
  notes: true,
  debtAccount: { select: { name: true } },
  period: { select: { monthStart: true } },
  linkedTransaction: { select: { id: true, occurredOn: true, description: true, amountMinor: true, currencyCode: true } },
} as const;

const debtPaymentSelect = {
  id: true,
  userId: true,
  periodId: true,
  debtAccountId: true,
  transactionId: true,
  amountMinor: true,
  currencyCode: true,
  paidOn: true,
  requiredPaymentOverrideMinor: true,
  notes: true,
} as const;

const activeDebtAccountSelect = {
  id: true,
  userId: true,
  currencyCode: true,
  status: true,
} as const;

const periodSelect = {
  id: true,
  userId: true,
  currencyCode: true,
} as const;

const transactionCandidateSelect = {
  id: true,
  periodId: true,
  occurredOn: true,
  description: true,
  amountMinor: true,
  currencyCode: true,
  category: { select: { name: true, type: true } },
} as const;

const linkedTransactionSelect = {
  id: true,
  userId: true,
  periodId: true,
  direction: true,
  amountMinor: true,
  currencyCode: true,
  category: { select: { type: true } },
  linkedDebtPayment: { select: { id: true } },
} as const;

export class PrismaOwnedDebtPaymentRepository implements OwnedDebtPaymentRepository {
  constructor(private readonly db: DebtPaymentPrismaClient) {}

  async listDebtPaymentsForOwner(ownerUserId: string) {
    const records = await findManyDebtPayments(this.db.debtPayment, {
      select: debtPaymentHistorySelect,
      where: { userId: ownerUserId },
      orderBy: [{ paidOn: "desc" }, { id: "asc" }],
    });

    return records.map(toOwnedDebtPaymentHistoryEntry);
  }

  async listDebtPaymentTransactionCandidatesForOwner(ownerUserId: string) {
    const transaction = transactionDelegate(this.db);
    const records = await findManyTransactions(transaction, {
      select: transactionCandidateSelect,
      where: {
        userId: ownerUserId,
        direction: "OUTFLOW",
        linkedDebtPayment: null,
        OR: [
          { category: { is: null } },
          { category: { is: { type: "DEBT_PAYMENT" } } },
        ],
      },
      orderBy: [{ occurredOn: "desc" }, { id: "asc" }],
    });

    return records.map(toOwnedTransactionCandidate);
  }

  async findActiveDebtAccountForOwner(ownerUserId: string, debtAccountId: string) {
    return findFirstDebtAccount(this.db.debtAccount, {
      select: activeDebtAccountSelect,
      where: { id: debtAccountId, userId: ownerUserId, status: "ACTIVE" },
    });
  }

  async findPeriodForOwner(ownerUserId: string, periodId: string) {
    return findFirstPeriod(this.db.period, {
      select: periodSelect,
      where: { id: periodId, userId: ownerUserId },
    });
  }

  async findDebtPaymentLinkTransactionForOwner(ownerUserId: string, transactionId: string) {
    const transaction = transactionDelegate(this.db);
    const record = await findFirstTransaction(transaction, {
      select: linkedTransactionSelect,
      where: { id: transactionId, userId: ownerUserId },
    });

    return record ? toOwnedLinkedTransaction(record) : null;
  }

  async createDebtPaymentForOwner(
    ownerUserId: string,
    input: CreateDebtPaymentForOwnerInput,
  ) {
    let record;
    try {
      record = await createDebtPayment(this.db.debtPayment, {
        data: {
          userId: ownerUserId,
          periodId: input.periodId,
          debtAccountId: input.debtAccountId,
          transactionId: input.linkedTransactionId,
          amountMinor: BigInt(input.amountMinor),
          currencyCode: input.currencyCode,
          paidOn: toDateOnlyDate(input.paidOn),
          requiredPaymentOverrideMinor: input.requiredPaymentOverrideMinor === null
            ? null
            : BigInt(input.requiredPaymentOverrideMinor),
          notes: input.notes,
        },
        select: debtPaymentSelect,
      });
    } catch (error) {
      if (isPrismaPeriodDebtAccountUniqueConstraintError(error)) throw new DuplicateDebtPaymentError();
      if (isPrismaTransactionUniqueConstraintError(error)) throw new DuplicateDebtPaymentTransactionLinkError();
      throw error;
    }

    return toOwnedDebtPayment(record);
  }
}

function transactionDelegate(db: DebtPaymentPrismaClient) {
  if (!db.transaction) throw new Error("Prisma transaction delegate is required for debt payment transaction links.");
  return db.transaction;
}

function isPrismaPeriodDebtAccountUniqueConstraintError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
    return false;
  }

  const target = prismaUniqueTarget(error);
  return Array.isArray(target)
    && target.length === 2
    && target.includes("periodId")
    && target.includes("debtAccountId");
}

function isPrismaTransactionUniqueConstraintError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
    return false;
  }

  const target = prismaUniqueTarget(error);
  return Array.isArray(target)
    && target.length === 1
    && target.includes("transactionId");
}

function prismaUniqueTarget(error: object) {
  return "meta" in error
    && typeof error.meta === "object"
    && error.meta !== null
    && "target" in error.meta
    ? error.meta.target
    : null;
}

function toOwnedDebtPayment(record: PrismaDebtPaymentRecord): OwnedDebtPayment {
  return {
    id: record.id,
    userId: record.userId,
    periodId: record.periodId,
    debtAccountId: record.debtAccountId,
    linkedTransactionId: record.transactionId,
    amountMinor: record.amountMinor.toString(),
    currencyCode: record.currencyCode,
    paidOn: toDateOnlyString(record.paidOn),
    requiredPaymentOverrideMinor: record.requiredPaymentOverrideMinor?.toString() ?? null,
    notes: record.notes,
  };
}

function toDateOnlyDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnlyString(value: Date | string | null) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function findFirstDebtAccount(
  delegate: DebtPaymentPrismaClient["debtAccount"],
  args: Record<string, unknown>,
) {
  return (delegate.findFirst as (
    args: Record<string, unknown>
  ) => Promise<OwnedDebtPaymentAccount | null>)(args);
}

function findFirstPeriod(
  delegate: DebtPaymentPrismaClient["period"],
  args: Record<string, unknown>,
) {
  return (delegate.findFirst as (
    args: Record<string, unknown>
  ) => Promise<OwnedDebtPaymentPeriod | null>)(args);
}

function createDebtPayment(
  delegate: DebtPaymentPrismaClient["debtPayment"],
  args: Record<string, unknown>,
) {
  return (delegate.create as (
    args: Record<string, unknown>
  ) => Promise<PrismaDebtPaymentRecord>)(args);
}

function findManyDebtPayments(
  delegate: DebtPaymentPrismaClient["debtPayment"],
  args: Record<string, unknown>,
) {
  return (delegate.findMany as (
    args: Record<string, unknown>
  ) => Promise<readonly PrismaDebtPaymentHistoryRecord[]>)(args);
}

function findManyTransactions(
  delegate: NonNullable<DebtPaymentPrismaClient["transaction"]>,
  args: Record<string, unknown>,
) {
  return (delegate.findMany as (
    args: Record<string, unknown>
  ) => Promise<readonly PrismaDebtPaymentTransactionCandidateRecord[]>)(args);
}

function findFirstTransaction(
  delegate: NonNullable<DebtPaymentPrismaClient["transaction"]>,
  args: Record<string, unknown>,
) {
  return (delegate.findFirst as (
    args: Record<string, unknown>
  ) => Promise<PrismaDebtPaymentLinkedTransactionRecord | null>)(args);
}
