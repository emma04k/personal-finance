import { describe, expect, it, vi } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import { createPeriodTransaction } from "@/modules/budget/application/period-transaction-workflow";
import type {
  OwnedCategory,
  OwnedPeriod,
  OwnedPlanningRepository,
  OwnedTransaction,
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

const expenseCategory: OwnedCategory = {
  id: "20000000-0000-0000-0000-000000000001",
  userId: owner.userId,
  type: "EXPENSE",
  name: "Groceries",
  sortOrder: 1,
  archivedAt: null,
};

const transaction: OwnedTransaction = {
  id: "40000000-0000-0000-0000-000000000001",
  userId: owner.userId,
  periodId: period.id,
  categoryId: expenseCategory.id,
  categoryName: expenseCategory.name,
  categoryType: expenseCategory.type,
  direction: "OUTFLOW",
  amountMinor: "12345",
  currencyCode: "COP",
  occurredOn: "2026-03-15",
  description: "Compra semanal",
};

function repository(overrides: Partial<Pick<OwnedPlanningRepository,
  "findPeriodForOwner" | "findCategoryForOwner" | "createTransactionForOwner"
>> = {}) {
  return {
    findPeriodForOwner: vi.fn(async () => period),
    findCategoryForOwner: vi.fn(async () => expenseCategory),
    createTransactionForOwner: vi.fn(async () => transaction),
    ...overrides,
  };
}

function periodWithCurrency(currencyCode: string): OwnedPeriod {
  return { ...period, currencyCode };
}

describe("period transaction workflow", () => {
  it("creates an actual transaction for the authenticated owner's active category and monthly period", async () => {
    const repo = repository();

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount: "123.45",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "  Compra semanal  ",
      },
    });

    expect(result).toEqual({ ok: true, value: { transaction } });
    expect(repo.findPeriodForOwner).toHaveBeenCalledWith(owner.userId, period.id);
    expect(repo.findCategoryForOwner).toHaveBeenCalledWith(owner.userId, expenseCategory.id);
    expect(repo.createTransactionForOwner).toHaveBeenCalledWith(owner.userId, {
      periodId: period.id,
      categoryId: expenseCategory.id,
      direction: "OUTFLOW",
      amountMinor: "12345",
      currencyCode: "COP",
      occurredOn: "2026-03-15",
      description: "Compra semanal",
    });
  });

  it.each([
    ["COP", "123.45", "12345"],
    ["USD", "123.45", "12345"],
    ["JPY", "123", "123"],
    ["KWD", "123.456", "123456"],
  ])("converts %s transaction amounts with currency-specific minor units", async (currencyCode, amount, amountMinor) => {
    const repo = repository({
      findPeriodForOwner: vi.fn(async () => periodWithCurrency(currencyCode)),
    });

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount,
        currencyCode,
        occurredOn: "2026-03-15",
        description: "Compra semanal",
      },
    });

    expect(result.ok).toBe(true);
    expect(repo.createTransactionForOwner).toHaveBeenCalledWith(owner.userId, expect.objectContaining({
      amountMinor,
      currencyCode,
    }));
  });

  it.each([
    ["", "empty"],
    ["0", "zero"],
    ["-1", "negative"],
    ["001", "leading zero"],
    ["10.123", "too many decimals"],
    ["92233720368547758.08", "above signed 64-bit minor units"],
  ])("rejects invalid transaction amounts before repository lookups: %s (%s)", async (amount) => {
    const repo = repository();

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount,
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "Compra semanal",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_TRANSACTION_AMOUNT", field: "amount" },
    });
    expect(repo.findPeriodForOwner).not.toHaveBeenCalled();
    expect(repo.createTransactionForOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["EURO", { code: "INVALID_CURRENCY_CODE", field: "currency" }],
    ["EUR", { code: "UNSUPPORTED_CURRENCY", field: "currency" }],
  ])("rejects malformed or unsupported currencies before owner-scoped lookups: %s", async (currencyCode, error) => {
    const repo = repository();

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount: "10.00",
        currencyCode,
        occurredOn: "2026-03-15",
        description: "Compra semanal",
      },
    });

    expect(result).toEqual({ ok: false, error });
    expect(repo.findPeriodForOwner).not.toHaveBeenCalled();
    expect(repo.createTransactionForOwner).not.toHaveBeenCalled();
  });

  it("rejects period ids that are not owned by the authenticated owner", async () => {
    const repo = repository({ findPeriodForOwner: vi.fn(async () => null) });

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: "10000000-0000-0000-0000-000000000999",
        categoryId: expenseCategory.id,
        amount: "10.00",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "Compra semanal",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "PERIOD_NOT_FOUND", field: "periodId" } });
    expect(repo.findCategoryForOwner).not.toHaveBeenCalled();
    expect(repo.createTransactionForOwner).not.toHaveBeenCalled();
  });

  it("rejects categories that are not owned by the authenticated owner", async () => {
    const repo = repository({ findCategoryForOwner: vi.fn(async () => null) });

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: "20000000-0000-0000-0000-000000000999",
        amount: "10.00",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "Compra semanal",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "CATEGORY_NOT_FOUND", field: "categoryId" } });
    expect(repo.createTransactionForOwner).not.toHaveBeenCalled();
  });

  it("rejects archived categories before writes", async () => {
    const repo = repository({
      findCategoryForOwner: vi.fn(async () => ({
        ...expenseCategory,
        archivedAt: "2026-04-01T00:00:00.000Z",
      })),
    });

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount: "10.00",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "Compra semanal",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "CATEGORY_NOT_ACTIVE", field: "categoryId" } });
    expect(repo.createTransactionForOwner).not.toHaveBeenCalled();
  });

  it("rejects currency mismatches between the period and submitted currency", async () => {
    const repo = repository({ findPeriodForOwner: vi.fn(async () => periodWithCurrency("USD")) });

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount: "10.00",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "Compra semanal",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "CURRENCY_MISMATCH", field: "currencyCode" } });
    expect(repo.findCategoryForOwner).not.toHaveBeenCalled();
    expect(repo.createTransactionForOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-02-28", "before period month"],
    ["2026-04-01", "after period month"],
  ])("rejects transaction dates outside the selected period month: %s (%s)", async (occurredOn) => {
    const repo = repository();

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount: "10.00",
        currencyCode: "COP",
        occurredOn,
        description: "Compra semanal",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "DATE_OUTSIDE_PERIOD", field: "occurredOn" } });
    expect(repo.findCategoryForOwner).not.toHaveBeenCalled();
    expect(repo.createTransactionForOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["", "empty"],
    ["2026/03/15", "bad shape"],
    ["2026-02-30", "invalid calendar date"],
  ])("rejects malformed transaction dates before category lookup: %s (%s)", async (occurredOn) => {
    const repo = repository();

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount: "10.00",
        currencyCode: "COP",
        occurredOn,
        description: "Compra semanal",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "INVALID_OCCURRED_ON", field: "occurredOn" } });
    expect(repo.findPeriodForOwner).toHaveBeenCalledWith(owner.userId, period.id);
    expect(repo.findCategoryForOwner).not.toHaveBeenCalled();
    expect(repo.createTransactionForOwner).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "x".repeat(256)])("rejects invalid or overlong descriptions before writes", async (description) => {
    const repo = repository();

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount: "10.00",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: description.trim().length === 0 ? "DESCRIPTION_REQUIRED" : "DESCRIPTION_TOO_LONG",
        field: "description",
      },
    });
    expect(repo.createTransactionForOwner).not.toHaveBeenCalled();
  });

  it("uses inflow direction for income categories", async () => {
    const incomeCategory: OwnedCategory = { ...expenseCategory, type: "INCOME", name: "Salary" };
    const repo = repository({ findCategoryForOwner: vi.fn(async () => incomeCategory) });

    const result = await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: incomeCategory.id,
        amount: "10.00",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "Salario",
      },
    });

    expect(result.ok).toBe(true);
    expect(repo.createTransactionForOwner).toHaveBeenCalledWith(owner.userId, expect.objectContaining({ direction: "INFLOW" }));
  });

  it("ignores forged client owner ids and uses the authenticated owner only", async () => {
    const repo = repository();

    await createPeriodTransaction({
      owner,
      repository: repo,
      input: {
        periodId: period.id,
        categoryId: expenseCategory.id,
        amount: "10.00",
        currencyCode: "COP",
        occurredOn: "2026-03-15",
        description: "Compra semanal",
        userId: "00000000-0000-0000-0000-000000000999",
      } as Parameters<typeof createPeriodTransaction>[0]["input"] & { readonly userId: string },
    });

    expect(repo.findPeriodForOwner).toHaveBeenCalledWith(owner.userId, period.id);
    expect(repo.findCategoryForOwner).toHaveBeenCalledWith(owner.userId, expenseCategory.id);
    expect(repo.createTransactionForOwner).toHaveBeenCalledWith(owner.userId, expect.not.objectContaining({ userId: expect.any(String) }));
  });
});
