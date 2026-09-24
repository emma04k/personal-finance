import type {
  CreateDebtPaymentForOwnerInput,
  OwnedDebtPayment,
  OwnedDebtPaymentAccount,
  OwnedDebtPaymentPeriod,
  OwnedDebtPaymentRepository,
} from "@/modules/debt/application/owned-debt-payment-repository";
import { DuplicateDebtPaymentError } from "@/modules/debt/application/owned-debt-payment-repository";

type PrismaDebtPaymentRecord = Omit<OwnedDebtPayment,
  "amountMinor" | "paidOn" | "requiredPaymentOverrideMinor"
> & {
  readonly amountMinor: bigint | number | string;
  readonly paidOn: Date | string | null;
  readonly requiredPaymentOverrideMinor: bigint | number | string | null;
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
  };
};

const debtPaymentSelect = {
  id: true,
  userId: true,
  periodId: true,
  debtAccountId: true,
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

export class PrismaOwnedDebtPaymentRepository implements OwnedDebtPaymentRepository {
  constructor(private readonly db: DebtPaymentPrismaClient) {}

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
      throw error;
    }

    return toOwnedDebtPayment(record);
  }
}

function isPrismaPeriodDebtAccountUniqueConstraintError(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
    return false;
  }

  const target = "meta" in error
    && typeof error.meta === "object"
    && error.meta !== null
    && "target" in error.meta
    ? error.meta.target
    : null;

  return Array.isArray(target)
    && target.length === 2
    && target.includes("periodId")
    && target.includes("debtAccountId");
}

function toOwnedDebtPayment(record: PrismaDebtPaymentRecord): OwnedDebtPayment {
  return {
    id: record.id,
    userId: record.userId,
    periodId: record.periodId,
    debtAccountId: record.debtAccountId,
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
