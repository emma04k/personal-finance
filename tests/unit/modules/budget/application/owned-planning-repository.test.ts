import { describe, expect, it } from "vitest";
import {
  DuplicateCategoryError,
  InMemoryOwnedPlanningRepository,
  type OwnedCategory,
  type OwnedPeriod,
  type OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";

const userA = "00000000-0000-0000-0000-000000000001";
const userB = "00000000-0000-0000-0000-000000000002";

const periods: OwnedPeriod[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    userId: userA,
    monthStart: "2026-01-01",
    currencyCode: "COP",
    timeZone: "America/Bogota",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    userId: userB,
    monthStart: "2026-01-01",
    currencyCode: "USD",
    timeZone: "UTC",
  },
];

const categories: OwnedCategory[] = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    userId: userA,
    type: "EXPENSE",
    name: "Groceries",
    sortOrder: 1,
    archivedAt: null,
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    userId: userB,
    type: "EXPENSE",
    name: "Rent",
    sortOrder: 1,
    archivedAt: null,
  },
];

const transactions: OwnedTransaction[] = [
  {
    id: "40000000-0000-0000-0000-000000000001",
    userId: userA,
    periodId: periods[0].id,
    categoryId: categories[0].id,
    categoryName: categories[0].name,
    categoryType: categories[0].type,
    direction: "OUTFLOW",
    amountMinor: "12345",
    currencyCode: "COP",
    occurredOn: "2026-01-15",
    description: "Compra semanal",
  },
  {
    id: "40000000-0000-0000-0000-000000000002",
    userId: userB,
    periodId: periods[1].id,
    categoryId: categories[1].id,
    categoryName: categories[1].name,
    categoryType: categories[1].type,
    direction: "OUTFLOW",
    amountMinor: "9900",
    currencyCode: "USD",
    occurredOn: "2026-01-16",
    description: "Renta demo",
  },
];

describe("owner-scoped planning repository seam", () => {
  it("lists only periods owned by the authenticated user", async () => {
    const repository = new InMemoryOwnedPlanningRepository({ periods, categories });

    await expect(repository.listPeriodsForOwner(userA)).resolves.toEqual([periods[0]]);
    await expect(repository.listPeriodsForOwner(userB)).resolves.toEqual([periods[1]]);
  });

  it("does not return another user's period by id", async () => {
    const repository = new InMemoryOwnedPlanningRepository({ periods, categories });

    await expect(repository.findPeriodForOwner(userA, periods[1].id)).resolves.toBeNull();
    await expect(repository.findPeriodForOwner(userA, periods[0].id)).resolves.toEqual(periods[0]);
  });

  it("lists only active categories owned by the authenticated user", async () => {
    const repository = new InMemoryOwnedPlanningRepository({
      periods,
      categories: [
        ...categories,
        { ...categories[0], id: "20000000-0000-0000-0000-000000000003", name: "Archived", archivedAt: "2026-02-01T00:00:00.000Z" },
      ],
    });

    await expect(repository.listActiveCategoriesForOwner(userA)).resolves.toEqual([categories[0]]);
    await expect(repository.listActiveCategoriesForOwner(userB)).resolves.toEqual([categories[1]]);
  });

  it("does not return another user's category by id", async () => {
    const repository = new InMemoryOwnedPlanningRepository({ periods, categories });

    await expect(repository.findCategoryForOwner(userA, categories[1].id)).resolves.toBeNull();
    await expect(repository.findCategoryForOwner(userA, categories[0].id)).resolves.toEqual(categories[0]);
  });

  it("creates categories for the authenticated owner without accepting client owner data", async () => {
    const repository = new InMemoryOwnedPlanningRepository({ periods, categories: [] });

    const category = await repository.createCategoryForOwner(userA, {
      type: "SAVINGS",
      name: "Emergency fund",
    });

    expect(category).toMatchObject({
      userId: userA,
      type: "SAVINGS",
      name: "Emergency fund",
      sortOrder: 0,
      archivedAt: null,
    });
    await expect(repository.listActiveCategoriesForOwner(userA)).resolves.toEqual([category]);
  });

  it("rejects duplicate categories with the same owner type and name", async () => {
    const repository = new InMemoryOwnedPlanningRepository({ periods, categories });

    await expect(
      repository.createCategoryForOwner(userA, { type: "EXPENSE", name: "Groceries" }),
    ).rejects.toBeInstanceOf(DuplicateCategoryError);
  });

  it("lists only transactions for the authenticated owner's selected period", async () => {
    const repository = new InMemoryOwnedPlanningRepository({ periods, categories, transactions });

    await expect(repository.listTransactionsForOwnerPeriod(userA, periods[0].id)).resolves.toEqual([
      transactions[0],
    ]);
    await expect(repository.listTransactionsForOwnerPeriod(userA, periods[1].id)).resolves.toEqual([]);
  });

  it("creates transactions for the authenticated owner without accepting client owner data", async () => {
    const repository = new InMemoryOwnedPlanningRepository({ periods, categories });

    const transaction = await repository.createTransactionForOwner(userA, {
      periodId: periods[0].id,
      categoryId: categories[0].id,
      direction: "OUTFLOW",
      amountMinor: "12345",
      currencyCode: "COP",
      occurredOn: "2026-01-15",
      description: "Compra semanal",
    });

    expect(transaction).toMatchObject({
      userId: userA,
      periodId: periods[0].id,
      categoryId: categories[0].id,
      categoryName: categories[0].name,
      categoryType: categories[0].type,
      amountMinor: "12345",
      description: "Compra semanal",
    });
    await expect(repository.listTransactionsForOwnerPeriod(userA, periods[0].id)).resolves.toEqual([
      transaction,
    ]);
    await expect(repository.listTransactionsForOwnerPeriod(userB, periods[0].id)).resolves.toEqual([]);
  });
});
