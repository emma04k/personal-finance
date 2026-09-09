import { describe, expect, it } from "vitest";
import {
  DuplicateCategoryError,
  InMemoryOwnedPlanningRepository,
  type OwnedCategory,
  type OwnedPeriod,
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
});
