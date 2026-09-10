import { describe, expect, it, vi } from "vitest";
import {
  DuplicateCategoryError,
  DuplicateMonthlyPeriodError,
} from "@/modules/budget/application/owned-planning-repository";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";
const otherPeriodId = "10000000-0000-0000-0000-000000000002";
const otherCategoryId = "20000000-0000-0000-0000-000000000002";

function baseRecord() {
  return {
    id: "30000000-0000-0000-0000-000000000001",
    userId: ownerUserId,
    periodId: "10000000-0000-0000-0000-000000000001",
    categoryId: "20000000-0000-0000-0000-000000000001",
    plannedAmountMinor: BigInt("5000"),
    currencyCode: "COP",
    category: { name: "Groceries", type: "EXPENSE" as const },
  };
}

describe("Prisma owner-scoped planning repository", () => {
  it("lists planned budget lines for one owned period with category labels", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "30000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        periodId: "10000000-0000-0000-0000-000000000001",
        categoryId: "20000000-0000-0000-0000-000000000001",
        plannedAmountMinor: BigInt("12345"),
        currencyCode: "COP",
        category: {
          name: "Groceries",
          type: "EXPENSE" as const,
        },
      },
    ]);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      budgetLine: {
        findMany,
        updateMany: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      } as never,
    });

    await expect(
      repository.listPlannedBudgetLinesForOwnerPeriod(
        ownerUserId,
        "10000000-0000-0000-0000-000000000001",
      ),
    ).resolves.toEqual([
      {
        id: "30000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        periodId: "10000000-0000-0000-0000-000000000001",
        categoryId: "20000000-0000-0000-0000-000000000001",
        categoryName: "Groceries",
        categoryType: "EXPENSE",
        plannedAmountMinor: "12345",
        currencyCode: "COP",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: ownerUserId,
        periodId: "10000000-0000-0000-0000-000000000001",
        kind: "PLANNED",
      },
      include: { category: { select: { name: true, type: true } } },
      orderBy: [
        { category: { type: "asc" } },
        { category: { sortOrder: "asc" } },
        { category: { name: "asc" } },
      ],
    });
  });

  it("updates only an existing planned line scoped to owner and kind", async () => {
    const existingRecord = baseRecord();
    const updatedRecord = { ...existingRecord, plannedAmountMinor: BigInt("7000") };
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn().mockResolvedValue(updatedRecord);
    const create = vi.fn();
    const update = vi.fn();
    const upsert = vi.fn();
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      budgetLine: { findMany: vi.fn(), updateMany, create, findFirst, update, upsert } as never,
    });

    await expect(
      repository.upsertPlannedBudgetLineForOwner(ownerUserId, {
        periodId: existingRecord.periodId,
        categoryId: existingRecord.categoryId,
        plannedAmountMinor: "7000",
        currencyCode: "COP",
      }),
    ).resolves.toMatchObject({
      id: existingRecord.id,
      plannedAmountMinor: "7000",
      categoryName: "Groceries",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: ownerUserId,
        periodId: existingRecord.periodId,
        categoryId: existingRecord.categoryId,
        kind: "PLANNED",
      },
      data: { plannedAmountMinor: BigInt("7000"), currencyCode: "COP" },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: ownerUserId,
        periodId: existingRecord.periodId,
        categoryId: existingRecord.categoryId,
        kind: "PLANNED",
      },
      include: { category: { select: { name: true, type: true } } },
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("cannot update an existing period-category row that belongs to another owner", async () => {
    const uniqueError = {
      code: "P2002",
      meta: { target: ["periodId", "categoryId"] },
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const create = vi.fn().mockRejectedValue(uniqueError);
    const findFirst = vi.fn().mockResolvedValue(null);
    const update = vi.fn();
    const upsert = vi.fn();
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      budgetLine: { findMany: vi.fn(), updateMany, create, findFirst, update, upsert } as never,
    });

    await expect(
      repository.upsertPlannedBudgetLineForOwner(ownerUserId, {
        periodId: otherPeriodId,
        categoryId: otherCategoryId,
        plannedAmountMinor: "7000",
        currencyCode: "COP",
      }),
    ).rejects.toBe(uniqueError);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: ownerUserId, periodId: otherPeriodId, categoryId: otherCategoryId, kind: "PLANNED" },
      data: { plannedAmountMinor: BigInt("7000"), currencyCode: "COP" },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: ownerUserId,
        periodId: otherPeriodId,
        categoryId: otherCategoryId,
        kind: "PLANNED",
        plannedAmountMinor: BigInt("7000"),
        currencyCode: "COP",
      },
      include: { category: { select: { name: true, type: true } } },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: ownerUserId, periodId: otherPeriodId, categoryId: otherCategoryId, kind: "PLANNED" },
      include: { category: { select: { name: true, type: true } } },
    });
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("cannot update an existing non-planned period-category row hidden from planned lists", async () => {
    const actualCollision = {
      code: "P2002",
      meta: { target: ["periodId", "categoryId"] },
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const create = vi.fn().mockRejectedValue(actualCollision);
    const findFirst = vi.fn().mockResolvedValue(null);
    const update = vi.fn();
    const upsert = vi.fn();
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      budgetLine: { findMany: vi.fn(), updateMany, create, findFirst, update, upsert } as never,
    });

    await expect(
      repository.upsertPlannedBudgetLineForOwner(ownerUserId, {
        periodId: "10000000-0000-0000-0000-000000000001",
        categoryId: "20000000-0000-0000-0000-000000000001",
        plannedAmountMinor: "7000",
        currencyCode: "COP",
      }),
    ).rejects.toBe(actualCollision);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        userId: ownerUserId,
        periodId: "10000000-0000-0000-0000-000000000001",
        categoryId: "20000000-0000-0000-0000-000000000001",
        kind: "PLANNED",
      },
      data: { plannedAmountMinor: BigInt("7000"), currencyCode: "COP" },
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: ownerUserId,
        periodId: "10000000-0000-0000-0000-000000000001",
        categoryId: "20000000-0000-0000-0000-000000000001",
        kind: "PLANNED",
      },
      include: { category: { select: { name: true, type: true } } },
    });
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("recovers from a planned-line create race by updating the owner's existing planned line", async () => {
    const existingRecord = baseRecord();
    const updatedRecord = { ...existingRecord, plannedAmountMinor: BigInt("7000") };
    const createRace = {
      code: "P2002",
      meta: { target: ["periodId", "categoryId"] },
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const create = vi.fn().mockRejectedValue(createRace);
    const findFirst = vi.fn().mockResolvedValue(existingRecord);
    const update = vi.fn().mockResolvedValue(updatedRecord);
    const upsert = vi.fn();
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      budgetLine: { findMany: vi.fn(), updateMany, create, findFirst, update, upsert } as never,
    });

    await expect(
      repository.upsertPlannedBudgetLineForOwner(ownerUserId, {
        periodId: existingRecord.periodId,
        categoryId: existingRecord.categoryId,
        plannedAmountMinor: "7000",
        currencyCode: "COP",
      }),
    ).resolves.toMatchObject({
      id: existingRecord.id,
      plannedAmountMinor: "7000",
      categoryName: "Groceries",
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: ownerUserId,
        periodId: existingRecord.periodId,
        categoryId: existingRecord.categoryId,
        kind: "PLANNED",
      },
      include: { category: { select: { name: true, type: true } } },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: existingRecord.id },
      data: { plannedAmountMinor: BigInt("7000"), currencyCode: "COP" },
      include: { category: { select: { name: true, type: true } } },
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rethrows the original P2002 when owner-kind scoped fallback reread finds no planned line", async () => {
    const originalError = {
      code: "P2002",
      meta: { target: ["periodId", "categoryId"] },
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const create = vi.fn().mockRejectedValue(originalError);
    const findFirst = vi.fn().mockResolvedValue(null);
    const update = vi.fn();
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      budgetLine: { findMany: vi.fn(), updateMany, create, findFirst, update, upsert: vi.fn() } as never,
    });

    await expect(
      repository.upsertPlannedBudgetLineForOwner(ownerUserId, {
        periodId: "10000000-0000-0000-0000-000000000001",
        categoryId: "20000000-0000-0000-0000-000000000001",
        plannedAmountMinor: "7000",
        currencyCode: "COP",
      }),
    ).rejects.toBe(originalError);
    expect(update).not.toHaveBeenCalled();
  });

  it("rethrows fallback update failures without hiding the update error", async () => {
    const existingRecord = baseRecord();
    const createRace = {
      code: "P2002",
      meta: { target: ["periodId", "categoryId"] },
    };
    const updateError = new Error("fallback update failed");
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const create = vi.fn().mockRejectedValue(createRace);
    const findFirst = vi.fn().mockResolvedValue(existingRecord);
    const update = vi.fn().mockRejectedValue(updateError);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      budgetLine: { findMany: vi.fn(), updateMany, create, findFirst, update, upsert: vi.fn() } as never,
    });

    await expect(
      repository.upsertPlannedBudgetLineForOwner(ownerUserId, {
        periodId: existingRecord.periodId,
        categoryId: existingRecord.categoryId,
        plannedAmountMinor: "7000",
        currencyCode: "COP",
      }),
    ).rejects.toBe(updateError);
  });

  it("creates planned lines with owner-scoped planned data when no scoped row exists", async () => {
    const record = { ...baseRecord(), plannedAmountMinor: BigInt("9000") };
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const create = vi.fn().mockResolvedValue(record);
    const findFirst = vi.fn();
    const update = vi.fn();
    const upsert = vi.fn();
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      budgetLine: { findMany: vi.fn(), updateMany, create, findFirst, update, upsert } as never,
    });

    await expect(
      repository.upsertPlannedBudgetLineForOwner(ownerUserId, {
        periodId: record.periodId,
        categoryId: record.categoryId,
        plannedAmountMinor: "9000",
        currencyCode: "COP",
      }),
    ).resolves.toMatchObject({
      userId: ownerUserId,
      plannedAmountMinor: "9000",
      currencyCode: "COP",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: ownerUserId,
        periodId: record.periodId,
        categoryId: record.categoryId,
        kind: "PLANNED",
        plannedAmountMinor: BigInt("9000"),
        currencyCode: "COP",
      },
      include: { category: { select: { name: true, type: true } } },
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rethrows unrelated planned-line P2002 errors without fallback updates", async () => {
    const uniqueError = {
      code: "P2002",
      meta: { target: ["userId", "periodId"] },
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const create = vi.fn().mockRejectedValue(uniqueError);
    const findFirst = vi.fn();
    const update = vi.fn();
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      budgetLine: { findMany: vi.fn(), updateMany, create, findFirst, update, upsert: vi.fn() } as never,
    });

    await expect(
      repository.upsertPlannedBudgetLineForOwner(ownerUserId, {
        periodId: "10000000-0000-0000-0000-000000000001",
        categoryId: "20000000-0000-0000-0000-000000000001",
        plannedAmountMinor: "7000",
        currencyCode: "COP",
      }),
    ).rejects.toBe(uniqueError);
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("scopes period lookups by authenticated owner", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst, create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    });

    await expect(repository.findPeriodForOwner(ownerUserId, otherPeriodId)).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: otherPeriodId, userId: ownerUserId },
    });
  });

  it("scopes monthly period lookups by authenticated owner", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst, create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    });

    await expect(repository.findPeriodByMonthForOwner(ownerUserId, "2026-03-01")).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: ownerUserId, monthStart: new Date("2026-03-01T00:00:00.000Z") },
    });
  });

  it("creates periods with the authenticated owner id in Prisma data", async () => {
    const created = {
      id: "10000000-0000-0000-0000-000000000003",
      userId: ownerUserId,
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      currencyCode: "COP",
      timeZone: "America/Bogota",
      note: null,
    };
    const create = vi.fn().mockResolvedValue(created);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    });

    await expect(
      repository.createPeriodForOwner(ownerUserId, {
        monthStart: "2026-03-01",
        currencyCode: "COP",
        timeZone: "America/Bogota",
        note: null,
      }),
    ).resolves.toEqual({ ...created, monthStart: "2026-03-01" });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: ownerUserId,
        monthStart: new Date("2026-03-01T00:00:00.000Z"),
        currencyCode: "COP",
        timeZone: "America/Bogota",
        note: null,
      },
    });
  });

  it("translates Prisma owner-month unique violations into duplicate monthly period errors", async () => {
    const create = vi.fn().mockRejectedValue({
      code: "P2002",
      meta: { target: ["userId", "monthStart"] },
    });
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    });

    await expect(
      repository.createPeriodForOwner(ownerUserId, {
        monthStart: "2026-03-01",
        currencyCode: "COP",
        timeZone: "America/Bogota",
        note: null,
      }),
    ).rejects.toBeInstanceOf(DuplicateMonthlyPeriodError);
  });

  it("does not translate unrelated Prisma unique violations as monthly duplicates", async () => {
    const uniqueError = {
      code: "P2002",
      meta: { target: ["id", "userId"] },
    };
    const create = vi.fn().mockRejectedValue(uniqueError);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    });

    await expect(
      repository.createPeriodForOwner(ownerUserId, {
        monthStart: "2026-03-01",
        currencyCode: "COP",
        timeZone: "America/Bogota",
        note: null,
      }),
    ).rejects.toBe(uniqueError);
  });

  it("scopes active category lists by authenticated owner", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany, findFirst: vi.fn(), create: vi.fn() },
    });

    await expect(repository.listActiveCategoriesForOwner(ownerUserId)).resolves.toEqual([]);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: ownerUserId, archivedAt: null },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  });

  it("scopes category lookups by authenticated owner", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst, create: vi.fn() },
    });

    await expect(repository.findCategoryForOwner(ownerUserId, otherCategoryId)).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: otherCategoryId, userId: ownerUserId },
    });
  });

  it("creates categories with the authenticated owner id in Prisma data", async () => {
    const created = {
      id: "20000000-0000-0000-0000-000000000003",
      userId: ownerUserId,
      type: "SAVINGS" as const,
      name: "Emergency fund",
      sortOrder: 0,
      archivedAt: null,
    };
    const create = vi.fn().mockResolvedValue(created);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create },
    });

    await expect(
      repository.createCategoryForOwner(ownerUserId, {
        type: "SAVINGS",
        name: "Emergency fund",
      }),
    ).resolves.toEqual(created);

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: ownerUserId,
        type: "SAVINGS",
        name: "Emergency fund",
      },
    });
  });

  it("translates Prisma owner type name unique violations into duplicate category errors", async () => {
    const create = vi.fn().mockRejectedValue({
      code: "P2002",
      meta: { target: ["userId", "type", "name"] },
    });
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create },
    });

    await expect(
      repository.createCategoryForOwner(ownerUserId, { type: "EXPENSE", name: "Groceries" }),
    ).rejects.toBeInstanceOf(DuplicateCategoryError);
  });

  it("does not translate unrelated Prisma unique violations as category duplicates", async () => {
    const uniqueError = {
      code: "P2002",
      meta: { target: ["id", "userId"] },
    };
    const create = vi.fn().mockRejectedValue(uniqueError);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create },
    });

    await expect(
      repository.createCategoryForOwner(ownerUserId, { type: "EXPENSE", name: "Groceries" }),
    ).rejects.toBe(uniqueError);
  });

  it("lists actual transactions for one owner period with category labels", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "40000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        periodId: "10000000-0000-0000-0000-000000000001",
        categoryId: "20000000-0000-0000-0000-000000000001",
        direction: "OUTFLOW" as const,
        amountMinor: BigInt("12345"),
        currencyCode: "COP",
        occurredOn: new Date("2026-03-15T00:00:00.000Z"),
        description: "Compra semanal",
        category: { name: "Groceries", type: "EXPENSE" as const },
      },
    ]);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      transaction: { findMany, create: vi.fn() } as never,
    });

    await expect(
      repository.listTransactionsForOwnerPeriod(
        ownerUserId,
        "10000000-0000-0000-0000-000000000001",
      ),
    ).resolves.toEqual([
      {
        id: "40000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        periodId: "10000000-0000-0000-0000-000000000001",
        categoryId: "20000000-0000-0000-0000-000000000001",
        categoryName: "Groceries",
        categoryType: "EXPENSE",
        direction: "OUTFLOW",
        amountMinor: "12345",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "Compra semanal",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: ownerUserId,
        periodId: "10000000-0000-0000-0000-000000000001",
        category: { isNot: null },
      },
      include: { category: { select: { name: true, type: true } } },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    });
  });

  it("filters transaction lists to categorized records before mapping category labels", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      transaction: { findMany, create: vi.fn() } as never,
    });

    await expect(
      repository.listTransactionsForOwnerPeriod(
        ownerUserId,
        "10000000-0000-0000-0000-000000000001",
      ),
    ).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: ownerUserId,
        periodId: "10000000-0000-0000-0000-000000000001",
        category: { isNot: null },
      }),
    }));
  });

  it("creates actual transactions with owner-scoped period and category data", async () => {
    const created = {
      id: "40000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      periodId: "10000000-0000-0000-0000-000000000001",
      categoryId: "20000000-0000-0000-0000-000000000001",
      direction: "OUTFLOW" as const,
      amountMinor: BigInt("12345"),
      currencyCode: "COP",
      occurredOn: new Date("2026-03-15T00:00:00.000Z"),
      description: "Compra semanal",
      category: { name: "Groceries", type: "EXPENSE" as const },
    };
    const create = vi.fn().mockResolvedValue(created);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      transaction: { findMany: vi.fn(), create } as never,
    });

    await expect(
      repository.createTransactionForOwner(ownerUserId, {
        periodId: created.periodId,
        categoryId: created.categoryId,
        direction: "OUTFLOW",
        amountMinor: "12345",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "Compra semanal",
      }),
    ).resolves.toMatchObject({
      userId: ownerUserId,
      categoryName: "Groceries",
      amountMinor: "12345",
      occurredOn: "2026-03-15",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: ownerUserId,
        periodId: created.periodId,
        categoryId: created.categoryId,
        direction: "OUTFLOW",
        amountMinor: BigInt("12345"),
        currencyCode: "COP",
        occurredOn: new Date("2026-03-15T00:00:00.000Z"),
        description: "Compra semanal",
      },
      include: { category: { select: { name: true, type: true } } },
    });
  });
});
