import {
  type CreateCategoryForOwnerInput,
  type CreateTransactionForOwnerInput,
  DuplicateCategoryError,
  DuplicateMonthlyPeriodError,
  type CreatePeriodForOwnerInput,
  type OwnedBudgetLine,
  type OwnedCategory,
  type OwnedPeriod,
  type OwnedPlanningRepository,
  type OwnedTransaction,
  type UpsertPlannedBudgetLineForOwnerInput,
} from "@/modules/budget/application/owned-planning-repository";

type PrismaPeriodRecord = Omit<OwnedPeriod, "monthStart"> & {
  readonly monthStart: Date | string;
};

type PrismaCategoryRecord = Omit<OwnedCategory, "archivedAt"> & {
  readonly archivedAt: Date | string | null;
};

type PrismaBudgetLineRecord = Omit<OwnedBudgetLine, "plannedAmountMinor" | "categoryName" | "categoryType"> & {
  readonly plannedAmountMinor: bigint | number | string;
  readonly category: Pick<OwnedCategory, "name" | "type">;
};

type PrismaTransactionRecord = Omit<OwnedTransaction,
  "amountMinor" | "categoryName" | "categoryType" | "occurredOn"
> & {
  readonly amountMinor: bigint | number | string;
  readonly occurredOn: Date | string;
  readonly category: Pick<OwnedCategory, "name" | "type">;
};

type PrismaDelegateMethod = (args: never) => Promise<unknown>;

type PlanningPrismaClient = {
  readonly period: {
    readonly findMany: PrismaDelegateMethod;
    readonly findFirst: PrismaDelegateMethod;
    readonly create: PrismaDelegateMethod;
  };
  readonly category: {
    readonly findMany: PrismaDelegateMethod;
    readonly findFirst: PrismaDelegateMethod;
    readonly create: PrismaDelegateMethod;
  };
  readonly budgetLine?: {
    readonly findMany: PrismaDelegateMethod;
    readonly updateMany: PrismaDelegateMethod;
    readonly create: PrismaDelegateMethod;
    readonly findFirst: PrismaDelegateMethod;
    readonly update: PrismaDelegateMethod;
  };
  readonly transaction?: {
    readonly findMany: PrismaDelegateMethod;
    readonly create: PrismaDelegateMethod;
  };
};

type BudgetLinePrismaDelegate = NonNullable<PlanningPrismaClient["budgetLine"]>;
type TransactionPrismaDelegate = NonNullable<PlanningPrismaClient["transaction"]>;

export class PrismaOwnedPlanningRepository implements OwnedPlanningRepository {
  constructor(private readonly db: PlanningPrismaClient) {}

  async listPeriodsForOwner(ownerUserId: string) {
    const records = await findManyPeriods(this.db.period, {
      where: { userId: ownerUserId },
      orderBy: { monthStart: "desc" },
    });

    return records.map(toOwnedPeriod);
  }

  async findPeriodForOwner(ownerUserId: string, periodId: string) {
    const record = await findFirstPeriod(this.db.period, {
      where: { id: periodId, userId: ownerUserId },
    });

    return record ? toOwnedPeriod(record) : null;
  }

  async findPeriodByMonthForOwner(ownerUserId: string, monthStart: string) {
    const record = await findFirstPeriod(this.db.period, {
      where: { userId: ownerUserId, monthStart: toMonthStartDate(monthStart) },
    });

    return record ? toOwnedPeriod(record) : null;
  }

  async createPeriodForOwner(ownerUserId: string, input: CreatePeriodForOwnerInput) {
    try {
      const record = await createPeriod(this.db.period, {
        data: {
          userId: ownerUserId,
          monthStart: toMonthStartDate(input.monthStart),
          currencyCode: input.currencyCode,
          timeZone: input.timeZone,
          note: input.note ?? null,
        },
      });

      return toOwnedPeriod(record);
    } catch (error) {
      if (isPrismaOwnerMonthUniqueConstraintError(error)) throw new DuplicateMonthlyPeriodError();
      throw error;
    }
  }

  async listActiveCategoriesForOwner(ownerUserId: string) {
    const records = await findManyCategories(this.db.category, {
      where: { userId: ownerUserId, archivedAt: null },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return records.map(toOwnedCategory);
  }

  async findCategoryForOwner(ownerUserId: string, categoryId: string) {
    const record = await findFirstCategory(this.db.category, {
      where: { id: categoryId, userId: ownerUserId },
    });

    return record ? toOwnedCategory(record) : null;
  }

  async createCategoryForOwner(ownerUserId: string, input: CreateCategoryForOwnerInput) {
    try {
      const record = await createCategory(this.db.category, {
        data: {
          userId: ownerUserId,
          type: input.type,
          name: input.name,
        },
      });

      return toOwnedCategory(record);
    } catch (error) {
      if (isPrismaOwnerTypeNameUniqueConstraintError(error)) throw new DuplicateCategoryError();
      throw error;
    }
  }

  async listPlannedBudgetLinesForOwnerPeriod(ownerUserId: string, periodId: string) {
    const budgetLine = budgetLineDelegate(this.db);
    const records = await findManyBudgetLines(budgetLine, {
      where: { userId: ownerUserId, periodId, kind: "PLANNED" },
      include: { category: { select: { name: true, type: true } } },
      orderBy: [
        { category: { type: "asc" } },
        { category: { sortOrder: "asc" } },
        { category: { name: "asc" } },
      ],
    });

    return records.map(toOwnedBudgetLine);
  }

  async upsertPlannedBudgetLineForOwner(
    ownerUserId: string,
    input: UpsertPlannedBudgetLineForOwnerInput,
  ) {
    const amount = BigInt(input.plannedAmountMinor);
    const budgetLine = budgetLineDelegate(this.db);
    const includeCategoryLabel = { category: { select: { name: true, type: true } } };
    const ownerPlannedLineWhere = {
      userId: ownerUserId,
      periodId: input.periodId,
      categoryId: input.categoryId,
      kind: "PLANNED",
    };

    const updateResult = await updateManyBudgetLines(budgetLine, {
      where: ownerPlannedLineWhere,
      data: { plannedAmountMinor: amount, currencyCode: input.currencyCode },
    });

    if (updateResult.count > 0) {
      const record = await findFirstBudgetLine(budgetLine, {
        where: ownerPlannedLineWhere,
        include: includeCategoryLabel,
      });
      if (!record) throw new Error("Updated planned budget line was not found.");
      return toOwnedBudgetLine(record);
    }

    try {
      const record = await createBudgetLine(budgetLine, {
        data: {
          userId: ownerUserId,
          periodId: input.periodId,
          categoryId: input.categoryId,
          kind: "PLANNED",
          plannedAmountMinor: amount,
          currencyCode: input.currencyCode,
        },
        include: includeCategoryLabel,
      });
      return toOwnedBudgetLine(record);
    } catch (error) {
      if (!isPrismaPeriodCategoryUniqueConstraintError(error)) throw error;

      const existing = await findFirstBudgetLine(budgetLine, {
        where: ownerPlannedLineWhere,
        include: includeCategoryLabel,
      });
      if (!existing) throw error;

      const updated = await updateBudgetLine(budgetLine, {
        where: { id: existing.id },
        data: { plannedAmountMinor: amount, currencyCode: input.currencyCode },
        include: includeCategoryLabel,
      });
      return toOwnedBudgetLine(updated);
    }
  }

  async listTransactionsForOwnerPeriod(ownerUserId: string, periodId: string) {
    const transaction = transactionDelegate(this.db);
    const records = await findManyTransactions(transaction, {
      where: { userId: ownerUserId, periodId, category: { isNot: null } },
      include: { category: { select: { name: true, type: true } } },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    });

    return records.map(toOwnedTransaction);
  }

  async createTransactionForOwner(
    ownerUserId: string,
    input: CreateTransactionForOwnerInput,
  ) {
    const transaction = transactionDelegate(this.db);
    const record = await createTransaction(transaction, {
      data: {
        userId: ownerUserId,
        periodId: input.periodId,
        categoryId: input.categoryId,
        direction: input.direction,
        amountMinor: BigInt(input.amountMinor),
        currencyCode: input.currencyCode,
        occurredOn: toDateOnlyDate(input.occurredOn),
        description: input.description,
      },
      include: { category: { select: { name: true, type: true } } },
    });

    return toOwnedTransaction(record);
  }
}

function findManyPeriods(
  period: PlanningPrismaClient["period"],
  args: Record<string, unknown>,
) {
  return (period.findMany as (args: Record<string, unknown>) => Promise<readonly PrismaPeriodRecord[]>)(args);
}

function findFirstPeriod(
  period: PlanningPrismaClient["period"],
  args: Record<string, unknown>,
) {
  return (period.findFirst as (args: Record<string, unknown>) => Promise<PrismaPeriodRecord | null>)(args);
}

function createPeriod(
  period: PlanningPrismaClient["period"],
  args: Record<string, unknown>,
) {
  return (period.create as (args: Record<string, unknown>) => Promise<PrismaPeriodRecord>)(args);
}

function isPrismaOwnerMonthUniqueConstraintError(error: unknown) {
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
    && target.includes("userId")
    && target.includes("monthStart");
}

function isPrismaOwnerTypeNameUniqueConstraintError(error: unknown) {
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
    && target.length === 3
    && target.includes("userId")
    && target.includes("type")
    && target.includes("name");
}

function isPrismaPeriodCategoryUniqueConstraintError(error: unknown) {
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
    && target.includes("categoryId");
}

function findManyCategories(
  category: PlanningPrismaClient["category"],
  args: Record<string, unknown>,
) {
  return (category.findMany as (args: Record<string, unknown>) => Promise<readonly PrismaCategoryRecord[]>)(args);
}

function budgetLineDelegate(db: PlanningPrismaClient): BudgetLinePrismaDelegate {
  if (!db.budgetLine) throw new Error("Budget line delegate is required for planned budget lines.");
  return db.budgetLine;
}

function transactionDelegate(db: PlanningPrismaClient): TransactionPrismaDelegate {
  if (!db.transaction) throw new Error("Transaction delegate is required for actual transactions.");
  return db.transaction;
}

function findFirstCategory(
  category: PlanningPrismaClient["category"],
  args: Record<string, unknown>,
) {
  return (category.findFirst as (args: Record<string, unknown>) => Promise<PrismaCategoryRecord | null>)(args);
}

function createCategory(
  category: PlanningPrismaClient["category"],
  args: Record<string, unknown>,
) {
  return (category.create as (args: Record<string, unknown>) => Promise<PrismaCategoryRecord>)(args);
}

function findManyBudgetLines(
  budgetLine: BudgetLinePrismaDelegate,
  args: Record<string, unknown>,
) {
  return (budgetLine.findMany as (
    args: Record<string, unknown>
  ) => Promise<readonly PrismaBudgetLineRecord[]>)(args);
}

function updateManyBudgetLines(
  budgetLine: BudgetLinePrismaDelegate,
  args: Record<string, unknown>,
) {
  return (budgetLine.updateMany as (
    args: Record<string, unknown>
  ) => Promise<{ readonly count: number }>)(args);
}

function createBudgetLine(
  budgetLine: BudgetLinePrismaDelegate,
  args: Record<string, unknown>,
) {
  return (budgetLine.create as (
    args: Record<string, unknown>
  ) => Promise<PrismaBudgetLineRecord>)(args);
}

function findFirstBudgetLine(
  budgetLine: BudgetLinePrismaDelegate,
  args: Record<string, unknown>,
) {
  return (budgetLine.findFirst as (
    args: Record<string, unknown>
  ) => Promise<PrismaBudgetLineRecord | null>)(args);
}

function updateBudgetLine(
  budgetLine: BudgetLinePrismaDelegate,
  args: Record<string, unknown>,
) {
  return (budgetLine.update as (
    args: Record<string, unknown>
  ) => Promise<PrismaBudgetLineRecord>)(args);
}

function findManyTransactions(
  transaction: TransactionPrismaDelegate,
  args: Record<string, unknown>,
) {
  return (transaction.findMany as (
    args: Record<string, unknown>
  ) => Promise<readonly PrismaTransactionRecord[]>)(args);
}

function createTransaction(
  transaction: TransactionPrismaDelegate,
  args: Record<string, unknown>,
) {
  return (transaction.create as (
    args: Record<string, unknown>
  ) => Promise<PrismaTransactionRecord>)(args);
}

function toDateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toMonthStartDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnlyDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toNullableIso(value: Date | string | null) {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toOwnedPeriod(record: PrismaPeriodRecord): OwnedPeriod {
  return {
    ...record,
    monthStart: toDateOnly(record.monthStart),
  };
}

function toOwnedCategory(record: PrismaCategoryRecord): OwnedCategory {
  return {
    ...record,
    archivedAt: toNullableIso(record.archivedAt),
  };
}

function toOwnedBudgetLine(record: PrismaBudgetLineRecord): OwnedBudgetLine {
  return {
    id: record.id,
    userId: record.userId,
    periodId: record.periodId,
    categoryId: record.categoryId,
    categoryName: record.category.name,
    categoryType: record.category.type,
    plannedAmountMinor: record.plannedAmountMinor.toString(),
    currencyCode: record.currencyCode,
  };
}

function toOwnedTransaction(record: PrismaTransactionRecord): OwnedTransaction {
  return {
    id: record.id,
    userId: record.userId,
    periodId: record.periodId,
    categoryId: record.categoryId,
    categoryName: record.category.name,
    categoryType: record.category.type,
    direction: record.direction,
    amountMinor: record.amountMinor.toString(),
    currencyCode: record.currencyCode,
    occurredOn: toDateOnly(record.occurredOn),
    description: record.description,
  };
}
