import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import {
  deletePlannedBudgetLine,
  updatePlannedBudgetLine,
  upsertPlannedBudgetLine,
} from "@/modules/budget/application/planned-budget-line-workflow";
import {
  DuplicatePlannedBudgetLineError,
  type OwnedBudgetLine,
  type OwnedCategory,
  type OwnedPeriod,
  type OwnedPlanningRepository,
} from "@/modules/budget/application/owned-planning-repository";

const owner: OwnershipContext = {
  userId: "00000000-0000-0000-0000-000000000001",
  role: "OWNER",
  email: "owner@example.test",
};

const period: OwnedPeriod = {
  id: "10000000-0000-0000-0000-000000000001",
  userId: owner.userId,
  monthStart: "2026-03-01",
  currencyCode: "COP",
  timeZone: "America/Bogota",
  note: null,
};

const nonCurrentOwnedPeriod: OwnedPeriod = {
  ...period,
  id: "10000000-0000-0000-0000-000000000002",
  monthStart: "2026-02-01",
};

const category: OwnedCategory = {
  id: "20000000-0000-0000-0000-000000000001",
  userId: owner.userId,
  type: "EXPENSE",
  name: "Groceries",
  sortOrder: 1,
  archivedAt: null,
};

const targetCategory: OwnedCategory = {
  id: "20000000-0000-0000-0000-000000000002",
  userId: owner.userId,
  type: "SAVINGS",
  name: "Emergency fund",
  sortOrder: 2,
  archivedAt: null,
};

const plannedLine: OwnedBudgetLine = {
  id: "30000000-0000-0000-0000-000000000001",
  userId: owner.userId,
  periodId: period.id,
  categoryId: category.id,
  categoryName: category.name,
  categoryType: category.type,
  plannedAmountMinor: "12345",
  currencyCode: "COP",
};

const updatedPlannedLine: OwnedBudgetLine = {
  ...plannedLine,
  categoryId: targetCategory.id,
  categoryName: targetCategory.name,
  categoryType: targetCategory.type,
  plannedAmountMinor: "55500",
};

function repository(overrides: Partial<Pick<OwnedPlanningRepository,
  "findPeriodForOwner" | "findCategoryForOwner" | "upsertPlannedBudgetLineForOwner"
>> = {}) {
  return {
    findPeriodForOwner: vi.fn(async () => period),
    findCategoryForOwner: vi.fn(async () => category),
    upsertPlannedBudgetLineForOwner: vi.fn(async () => plannedLine),
    ...overrides,
  };
}

function deleteRepository(overrides: Partial<Pick<OwnedPlanningRepository,
  "listPeriodsForOwner" | "deletePlannedBudgetLineForOwnerPeriod"
>> = {}) {
  return {
    listPeriodsForOwner: vi.fn(async () => [period]),
    deletePlannedBudgetLineForOwnerPeriod: vi.fn(async () => true),
    ...overrides,
  };
}

function updateRepository(overrides: Partial<Pick<OwnedPlanningRepository,
  | "listPeriodsForOwner"
  | "findCategoryForOwner"
  | "listPlannedBudgetLinesForOwnerPeriod"
  | "updatePlannedBudgetLineForOwnerPeriod"
>> = {}) {
  return {
    listPeriodsForOwner: vi.fn(async () => [period]),
    findCategoryForOwner: vi.fn(async () => targetCategory),
    listPlannedBudgetLinesForOwnerPeriod: vi.fn(async () => [plannedLine]),
    updatePlannedBudgetLineForOwnerPeriod: vi.fn(async () => updatedPlannedLine),
    ...overrides,
  };
}

function periodWithCurrency(currencyCode: string): OwnedPeriod {
  return { ...period, currencyCode };
}

describe("planned budget line workflow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes an owned planned line from the server-displayed current period", async () => {
    const repo = deleteRepository();

    const result = await deletePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: plannedLine.id,
      },
    });

    expect(result).toEqual({ ok: true, value: { deleted: true } });
    expect(repo.listPeriodsForOwner).toHaveBeenCalledWith(owner.userId);
    expect(repo.deletePlannedBudgetLineForOwnerPeriod).toHaveBeenCalledWith(owner.userId, {
      periodId: period.id,
      budgetLineId: plannedLine.id,
    });
  });

  it("rejects deleting missing planned lines outside the authenticated owner's current period", async () => {
    const repo = deleteRepository({ deletePlannedBudgetLineForOwnerPeriod: vi.fn(async () => false) });

    const result = await deletePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: "30000000-0000-0000-0000-000000000999",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "PLANNED_LINE_NOT_FOUND", field: "budgetLineId" },
    });
    expect(repo.deletePlannedBudgetLineForOwnerPeriod).toHaveBeenCalledWith(owner.userId, {
      periodId: period.id,
      budgetLineId: "30000000-0000-0000-0000-000000000999",
    });
  });

  it("rejects deleting an owned planned line from an owned period that is not the server-displayed current period", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
    const repo = deleteRepository({
      listPeriodsForOwner: vi.fn(async () => [nonCurrentOwnedPeriod, period]),
    });

    const result = await deletePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: nonCurrentOwnedPeriod.id,
        budgetLineId: plannedLine.id,
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "PERIOD_NOT_FOUND", field: "periodId" } });
    expect(repo.listPeriodsForOwner).toHaveBeenCalledWith(owner.userId);
    expect(repo.deletePlannedBudgetLineForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("updates an owned current-period planned line amount and category", async () => {
    const repo = updateRepository();

    const result = await updatePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: plannedLine.id,
        categoryId: targetCategory.id,
        plannedAmount: "555.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({ ok: true, value: { budgetLine: updatedPlannedLine } });
    expect(repo.listPeriodsForOwner).toHaveBeenCalledWith(owner.userId);
    expect(repo.findCategoryForOwner).toHaveBeenCalledWith(owner.userId, targetCategory.id);
    expect(repo.updatePlannedBudgetLineForOwnerPeriod).toHaveBeenCalledWith(owner.userId, {
      periodId: period.id,
      budgetLineId: plannedLine.id,
      categoryId: targetCategory.id,
      plannedAmountMinor: "55500",
      currencyCode: "COP",
    });
  });

  it("rejects editing an owned planned line from an owned non-current period", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
    const repo = updateRepository({
      listPeriodsForOwner: vi.fn(async () => [nonCurrentOwnedPeriod, period]),
    });

    const result = await updatePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: nonCurrentOwnedPeriod.id,
        budgetLineId: plannedLine.id,
        categoryId: targetCategory.id,
        plannedAmount: "555.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "PERIOD_NOT_FOUND", field: "periodId" } });
    expect(repo.findCategoryForOwner).not.toHaveBeenCalled();
    expect(repo.updatePlannedBudgetLineForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("rejects planned-line edits that would duplicate another category in the displayed period", async () => {
    const duplicateLine: OwnedBudgetLine = {
      ...plannedLine,
      id: "30000000-0000-0000-0000-000000000002",
      categoryId: targetCategory.id,
      categoryName: targetCategory.name,
      categoryType: targetCategory.type,
    };
    const repo = updateRepository({
      listPlannedBudgetLinesForOwnerPeriod: vi.fn(async () => [plannedLine, duplicateLine]),
    });

    const result = await updatePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: plannedLine.id,
        categoryId: targetCategory.id,
        plannedAmount: "555.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "DUPLICATE_PLANNED_LINE", field: "categoryId" } });
    expect(repo.updatePlannedBudgetLineForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("returns duplicate feedback when a category-changing planned-line edit hits a unique race", async () => {
    const duplicateRace = new DuplicatePlannedBudgetLineError();
    const repo = updateRepository({
      updatePlannedBudgetLineForOwnerPeriod: vi.fn(async () => {
        throw duplicateRace;
      }),
    });

    const result = await updatePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: plannedLine.id,
        categoryId: targetCategory.id,
        plannedAmount: "555.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "DUPLICATE_PLANNED_LINE", field: "categoryId" } });
    expect(repo.updatePlannedBudgetLineForOwnerPeriod).toHaveBeenCalledWith(owner.userId, {
      periodId: period.id,
      budgetLineId: plannedLine.id,
      categoryId: targetCategory.id,
      plannedAmountMinor: "55500",
      currencyCode: "COP",
    });
  });

  it("returns planned-line missing feedback when no owner-period scoped planned line is updated", async () => {
    const repo = updateRepository({
      updatePlannedBudgetLineForOwnerPeriod: vi.fn(async () => null),
    });

    const result = await updatePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: "30000000-0000-0000-0000-000000000999",
        categoryId: targetCategory.id,
        plannedAmount: "555.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "PLANNED_LINE_NOT_FOUND", field: "budgetLineId" } });
  });

  it("returns missing instead of duplicate feedback for forged planned-line edit ids", async () => {
    const repo = updateRepository({
      findCategoryForOwner: vi.fn(async () => category),
    });

    const result = await updatePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: "30000000-0000-0000-0000-000000000999",
        categoryId: category.id,
        plannedAmount: "555.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "PLANNED_LINE_NOT_FOUND", field: "budgetLineId" } });
    expect(repo.updatePlannedBudgetLineForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("rejects invalid planned-line edit amounts before owner-scoped lookups", async () => {
    const repo = updateRepository();

    const result = await updatePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: plannedLine.id,
        categoryId: targetCategory.id,
        plannedAmount: "001",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "INVALID_PLANNED_AMOUNT", field: "plannedAmount" } });
    expect(repo.listPeriodsForOwner).not.toHaveBeenCalled();
    expect(repo.updatePlannedBudgetLineForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("rejects planned-line edits with currency mismatches before category lookup", async () => {
    const repo = updateRepository();

    const result = await updatePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: plannedLine.id,
        categoryId: targetCategory.id,
        plannedAmount: "555.00",
        currencyCode: "USD",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "CURRENCY_MISMATCH", field: "currencyCode" } });
    expect(repo.findCategoryForOwner).not.toHaveBeenCalled();
    expect(repo.updatePlannedBudgetLineForOwnerPeriod).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null, "CATEGORY_NOT_FOUND"],
    ["inactive", { ...targetCategory, archivedAt: "2026-04-01T00:00:00.000Z" }, "CATEGORY_NOT_ACTIVE"],
    ["invalid type", { ...targetCategory, type: "TRANSFER" as OwnedCategory["type"] }, "INVALID_CATEGORY_TYPE"],
  ] as const)("rejects %s target categories before planned-line edit writes", async (_label, foundCategory, code) => {
    const repo = updateRepository({
      findCategoryForOwner: vi.fn(async () => foundCategory),
    });

    const result = await updatePlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        budgetLineId: plannedLine.id,
        categoryId: targetCategory.id,
        plannedAmount: "555.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({ ok: false, error: { code, field: "categoryId" } });
    expect(repo.updatePlannedBudgetLineForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("upserts a planned amount for the authenticated owner's active category and owned period", async () => {
    const repo = repository();

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount: "123.45",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({ ok: true, value: { budgetLine: plannedLine } });
    expect(repo.findPeriodForOwner).toHaveBeenCalledWith(owner.userId, period.id);
    expect(repo.findCategoryForOwner).toHaveBeenCalledWith(owner.userId, category.id);
    expect(repo.upsertPlannedBudgetLineForOwner).toHaveBeenCalledWith(owner.userId, {
      periodId: period.id,
      categoryId: category.id,
      plannedAmountMinor: "12345",
      currencyCode: "COP",
    });
  });

  it.each([
    ["", "empty"],
    ["-1", "negative"],
    ["+10", "plus sign"],
    ["1e2", "exponent"],
    ["001", "leading zero"],
    ["00", "double zero"],
    [" 10", "leading whitespace"],
    ["10 ", "trailing whitespace"],
  ])("rejects non-canonical planned amounts before repository lookups: %s (%s)", async (plannedAmount) => {
    const repo = repository();

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount,
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_PLANNED_AMOUNT", field: "plannedAmount" },
    });
    expect(repo.findPeriodForOwner).not.toHaveBeenCalled();
    expect(repo.findCategoryForOwner).not.toHaveBeenCalled();
    expect(repo.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  });

  it("rejects planned amounts above the positive signed 64-bit storage range", async () => {
    const repo = repository();

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount: "92233720368547758.08",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_PLANNED_AMOUNT", field: "plannedAmount" },
    });
    expect(repo.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["COP", "1500.50", "150050"],
    ["USD", "1500.50", "150050"],
    ["JPY", "1500", "1500"],
    ["KWD", "1.234", "1234"],
  ])("converts %s user-facing amounts to canonical minor units", async (currencyCode, plannedAmount, expectedMinorUnits) => {
    const repo = repository({ findPeriodForOwner: vi.fn(async () => periodWithCurrency(currencyCode)) });

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount,
        currencyCode,
      },
    });

    expect(result.ok).toBe(true);
    expect(repo.upsertPlannedBudgetLineForOwner).toHaveBeenCalledWith(owner.userId, {
      periodId: period.id,
      categoryId: category.id,
      plannedAmountMinor: expectedMinorUnits,
      currencyCode,
    });
  });

  it.each([
    ["COP", "10.123"],
    ["USD", "10.123"],
    ["JPY", "10.1"],
    ["KWD", "10.1234"],
  ])("rejects %s amounts with unsupported decimal precision", async (currencyCode, plannedAmount) => {
    const repo = repository({ findPeriodForOwner: vi.fn(async () => periodWithCurrency(currencyCode)) });

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount,
        currencyCode,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_PLANNED_AMOUNT", field: "plannedAmount" },
    });
    expect(repo.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  });

  it("rejects invalid currencies before owner-scoped lookups", async () => {
    const repo = repository();

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount: "10.00",
        currencyCode: "EURO",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_CURRENCY_CODE", field: "currency" },
    });
    expect(repo.findPeriodForOwner).not.toHaveBeenCalled();
    expect(repo.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  });

  it("rejects unsupported currencies before owner-scoped lookups", async () => {
    const repo = repository();

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount: "10.00",
        currencyCode: "EUR",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "UNSUPPORTED_CURRENCY", field: "currency" },
    });
    expect(repo.findPeriodForOwner).not.toHaveBeenCalled();
    expect(repo.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  });

  it("rejects period ids that are not owned by the authenticated owner", async () => {
    const repo = repository({ findPeriodForOwner: vi.fn(async () => null) });

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: "10000000-0000-0000-0000-000000000999",
        categoryId: category.id,
        plannedAmount: "10.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "PERIOD_NOT_FOUND", field: "periodId" },
    });
    expect(repo.findPeriodForOwner).toHaveBeenCalledWith(
      owner.userId,
      "10000000-0000-0000-0000-000000000999",
    );
    expect(repo.findCategoryForOwner).not.toHaveBeenCalled();
    expect(repo.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  });

  it("rejects categories that are not owned by the authenticated owner", async () => {
    const repo = repository({ findCategoryForOwner: vi.fn(async () => null) });

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: "20000000-0000-0000-0000-000000000999",
        plannedAmount: "10.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "CATEGORY_NOT_FOUND", field: "categoryId" },
    });
    expect(repo.findCategoryForOwner).toHaveBeenCalledWith(
      owner.userId,
      "20000000-0000-0000-0000-000000000999",
    );
    expect(repo.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  });

  it("rejects archived categories before writes", async () => {
    const repo = repository({
      findCategoryForOwner: vi.fn(async () => ({
        ...category,
        archivedAt: "2026-04-01T00:00:00.000Z",
      })),
    });

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount: "10.00",
        currencyCode: "COP",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "CATEGORY_NOT_ACTIVE", field: "categoryId" },
    });
    expect(repo.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  });

  it("rejects currency mismatches between the period and submitted currency", async () => {
    const repo = repository();

    const result = await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount: "10.00",
        currencyCode: "USD",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "CURRENCY_MISMATCH", field: "currencyCode" },
    });
    expect(repo.findCategoryForOwner).not.toHaveBeenCalled();
    expect(repo.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  });

  it("ignores forged client owner ids and uses the authenticated owner only", async () => {
    const repo = repository();

    await upsertPlannedBudgetLine({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: category.id,
        plannedAmount: "0",
        currencyCode: "COP",
        userId: "00000000-0000-0000-0000-000000000999",
      } as Parameters<typeof upsertPlannedBudgetLine>[0]["input"] & { readonly userId: string },
    });

    expect(repo.findPeriodForOwner).toHaveBeenCalledWith(owner.userId, period.id);
    expect(repo.findCategoryForOwner).toHaveBeenCalledWith(owner.userId, category.id);
    expect(repo.upsertPlannedBudgetLineForOwner).toHaveBeenCalledWith(owner.userId, {
      periodId: period.id,
      categoryId: category.id,
      plannedAmountMinor: "0",
      currencyCode: "COP",
    });
  });
});
