import { describe, expect, it, vi } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import { upsertPlannedBudgetLine } from "@/modules/budget/application/planned-budget-line-workflow";
import type {
  OwnedBudgetLine,
  OwnedCategory,
  OwnedPeriod,
  OwnedPlanningRepository,
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

const category: OwnedCategory = {
  id: "20000000-0000-0000-0000-000000000001",
  userId: owner.userId,
  type: "EXPENSE",
  name: "Groceries",
  sortOrder: 1,
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

function periodWithCurrency(currencyCode: string): OwnedPeriod {
  return { ...period, currencyCode };
}

describe("planned budget line workflow", () => {
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
