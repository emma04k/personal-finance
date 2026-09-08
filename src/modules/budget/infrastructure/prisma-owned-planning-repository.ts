import type {
  OwnedCategory,
  OwnedPeriod,
  OwnedPlanningRepository,
} from "@/modules/budget/application/owned-planning-repository";

type PrismaPeriodRecord = Omit<OwnedPeriod, "monthStart"> & {
  readonly monthStart: Date | string;
};

type PrismaCategoryRecord = Omit<OwnedCategory, "archivedAt"> & {
  readonly archivedAt: Date | string | null;
};

type PlanningPrismaClient = {
  readonly period: {
    readonly findMany: (args: Record<string, unknown>) => Promise<readonly PrismaPeriodRecord[]>;
    readonly findFirst: (args: Record<string, unknown>) => Promise<PrismaPeriodRecord | null>;
  };
  readonly category: {
    readonly findMany: (args: Record<string, unknown>) => Promise<readonly PrismaCategoryRecord[]>;
    readonly findFirst: (args: Record<string, unknown>) => Promise<PrismaCategoryRecord | null>;
  };
};

export class PrismaOwnedPlanningRepository implements OwnedPlanningRepository {
  constructor(private readonly db: PlanningPrismaClient) {}

  async listPeriodsForOwner(ownerUserId: string) {
    const records = await this.db.period.findMany({
      where: { userId: ownerUserId },
      orderBy: { monthStart: "desc" },
    });

    return records.map(toOwnedPeriod);
  }

  async findPeriodForOwner(ownerUserId: string, periodId: string) {
    const record = await this.db.period.findFirst({
      where: { id: periodId, userId: ownerUserId },
    });

    return record ? toOwnedPeriod(record) : null;
  }

  async listActiveCategoriesForOwner(ownerUserId: string) {
    const records = await this.db.category.findMany({
      where: { userId: ownerUserId, archivedAt: null },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return records.map(toOwnedCategory);
  }

  async findCategoryForOwner(ownerUserId: string, categoryId: string) {
    const record = await this.db.category.findFirst({
      where: { id: categoryId, userId: ownerUserId },
    });

    return record ? toOwnedCategory(record) : null;
  }
}

function toDateOnly(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
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
