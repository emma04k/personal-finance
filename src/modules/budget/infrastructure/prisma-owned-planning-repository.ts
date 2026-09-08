import {
  DuplicateMonthlyPeriodError,
  type CreatePeriodForOwnerInput,
  type OwnedCategory,
  type OwnedPeriod,
  type OwnedPlanningRepository,
} from "@/modules/budget/application/owned-planning-repository";

type PrismaPeriodRecord = Omit<OwnedPeriod, "monthStart"> & {
  readonly monthStart: Date | string;
};

type PrismaCategoryRecord = Omit<OwnedCategory, "archivedAt"> & {
  readonly archivedAt: Date | string | null;
};

type PlanningPrismaClient = {
  readonly period: {
    readonly findMany: (args: never) => Promise<readonly PrismaPeriodRecord[]>;
    readonly findFirst: (args: never) => Promise<PrismaPeriodRecord | null>;
    readonly create: (args: never) => Promise<PrismaPeriodRecord>;
  };
  readonly category: {
    readonly findMany: (args: never) => Promise<readonly PrismaCategoryRecord[]>;
    readonly findFirst: (args: never) => Promise<PrismaCategoryRecord | null>;
  };
};

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

function findManyCategories(
  category: PlanningPrismaClient["category"],
  args: Record<string, unknown>,
) {
  return (category.findMany as (args: Record<string, unknown>) => Promise<readonly PrismaCategoryRecord[]>)(args);
}

function findFirstCategory(
  category: PlanningPrismaClient["category"],
  args: Record<string, unknown>,
) {
  return (category.findFirst as (args: Record<string, unknown>) => Promise<PrismaCategoryRecord | null>)(args);
}

function toDateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toMonthStartDate(value: string) {
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
