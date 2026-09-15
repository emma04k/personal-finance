import { describe, expect, it } from "vitest";
import { buildMonthlyBudgetSummary } from "@/modules/budget/application/monthly-budget-summary-workflow";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";

const ownerId = "00000000-0000-0000-0000-000000000001";

const period: OwnedPeriod = {
  id: "10000000-0000-0000-0000-000000000001",
  userId: ownerId,
  monthStart: "2026-03-01",
  currencyCode: "COP",
  timeZone: "America/Bogota",
  note: null,
};

function plannedLine(overrides: Partial<OwnedBudgetLine>): OwnedBudgetLine {
  return {
    id: `line-${overrides.categoryId ?? "unknown"}`,
    userId: overrides.userId ?? ownerId,
    periodId: overrides.periodId ?? period.id,
    categoryId: overrides.categoryId ?? "category",
    categoryName: overrides.categoryName ?? "Category",
    categoryType: overrides.categoryType ?? "EXPENSE",
    plannedAmountMinor: overrides.plannedAmountMinor ?? "0",
    currencyCode: overrides.currencyCode ?? period.currencyCode,
  };
}

function transaction(overrides: Partial<OwnedTransaction>): OwnedTransaction {
  return {
    id: `tx-${overrides.categoryId ?? "unknown"}-${overrides.amountMinor ?? "0"}`,
    userId: overrides.userId ?? ownerId,
    periodId: overrides.periodId ?? period.id,
    categoryId: overrides.categoryId ?? "category",
    categoryName: overrides.categoryName ?? "Category",
    categoryType: overrides.categoryType ?? "EXPENSE",
    direction: overrides.direction ?? "OUTFLOW",
    amountMinor: overrides.amountMinor ?? "0",
    currencyCode: overrides.currencyCode ?? period.currencyCode,
    occurredOn: overrides.occurredOn ?? "2026-03-15",
    description: overrides.description ?? "Synthetic movement",
  };
}

describe("monthly budget summary workflow", () => {
  it("maps current-period planned lines and transactions into budget summary groups", () => {
    const result = buildMonthlyBudgetSummary({
      period,
      plannedBudgetLines: [
        plannedLine({ categoryId: "salary", categoryName: "Salary", categoryType: "INCOME", plannedAmountMinor: "500000" }),
        plannedLine({ categoryId: "groceries", categoryName: "Groceries", categoryType: "EXPENSE", plannedAmountMinor: "200000" }),
        plannedLine({ categoryId: "loan", categoryName: "Loan", categoryType: "DEBT_PAYMENT", plannedAmountMinor: "100000" }),
        plannedLine({ categoryId: "reserve", categoryName: "Reserve", categoryType: "SAVINGS", plannedAmountMinor: "150000" }),
      ],
      transactions: [
        transaction({ categoryId: "salary", categoryName: "Salary", categoryType: "INCOME", direction: "INFLOW", amountMinor: "520000" }),
        transaction({ categoryId: "groceries", categoryName: "Groceries", categoryType: "EXPENSE", amountMinor: "80000" }),
        transaction({ categoryId: "groceries", categoryName: "Groceries", categoryType: "EXPENSE", amountMinor: "20000" }),
        transaction({ categoryId: "loan", categoryName: "Loan", categoryType: "DEBT_PAYMENT", amountMinor: "100000" }),
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        income: { amount: { minorUnits: BigInt("520000") }, completeness: "complete", plannedValuesUsed: false },
        consumptionExpenses: { amount: { minorUnits: BigInt("100000") }, completeness: "complete", plannedValuesUsed: false },
        debtPayments: { amount: { minorUnits: BigInt("100000") }, completeness: "complete", plannedValuesUsed: false },
        savingsAllocations: { amount: { minorUnits: BigInt("150000") }, completeness: "complete", plannedValuesUsed: true },
        totalCashOutflow: { amount: { minorUnits: BigInt("350000") }, completeness: "complete", plannedValuesUsed: true },
        availableBalance: { minorUnits: BigInt("170000") },
        incomeVariance: { available: true, value: { minorUnits: BigInt("20000") } },
        expenseVariance: { available: false, reason: "PARTIAL_DATA" },
      },
    });

    if (!result.ok) throw new Error("Expected a valid synthetic summary");
    expect(result.value.categoryUtilization).toEqual([
      { id: "groceries", utilization: { available: true, ratio: { numerator: BigInt("100000"), denominator: BigInt("200000") } } },
      { id: "loan", utilization: { available: true, ratio: { numerator: BigInt("100000"), denominator: BigInt("100000") } } },
      { id: "reserve", utilization: { available: true, ratio: { numerator: BigInt("150000"), denominator: BigInt("150000") } } },
    ]);
  });

  it("fails closed instead of converting mixed-currency period records", () => {
    const result = buildMonthlyBudgetSummary({
      period,
      plannedBudgetLines: [
        plannedLine({ categoryId: "groceries", categoryName: "Groceries", categoryType: "EXPENSE", plannedAmountMinor: "200000", currencyCode: "USD" }),
      ],
      transactions: [],
    });

    expect(result).toEqual({ ok: false, error: { code: "CURRENCY_MISMATCH", field: "currency" } });
  });

  it("fails closed instead of converting mixed-currency transaction records", () => {
    const result = buildMonthlyBudgetSummary({
      period,
      plannedBudgetLines: [],
      transactions: [
        transaction({ categoryId: "salary", categoryType: "INCOME", direction: "INFLOW", amountMinor: "100000", currencyCode: "USD" }),
      ],
    });

    expect(result).toEqual({ ok: false, error: { code: "CURRENCY_MISMATCH", field: "currency" } });
  });

  it.each(["01", "1.25", "-1", "1e3", " 1"])(
    "rejects noncanonical planned amount minor units %s",
    (plannedAmountMinor) => {
      const result = buildMonthlyBudgetSummary({
        period,
        plannedBudgetLines: [plannedLine({ categoryId: "groceries", plannedAmountMinor })],
        transactions: [],
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "INVALID_MONTHLY_SUMMARY_AMOUNT", field: "plannedAmountMinor" },
      });
    },
  );

  it.each(["01", "1.25", "-1", "1e3", " 1"])(
    "rejects noncanonical transaction amount minor units %s",
    (amountMinor) => {
      const result = buildMonthlyBudgetSummary({
        period,
        plannedBudgetLines: [],
        transactions: [transaction({ categoryId: "groceries", amountMinor })],
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "INVALID_MONTHLY_SUMMARY_AMOUNT", field: "amountMinor" },
      });
    },
  );

  it("ignores planned lines and transactions outside the selected period", () => {
    const result = buildMonthlyBudgetSummary({
      period,
      plannedBudgetLines: [
        plannedLine({ categoryId: "salary", categoryType: "INCOME", plannedAmountMinor: "1000" }),
        plannedLine({
          categoryId: "ignored-line",
          periodId: "10000000-0000-0000-0000-000000000002",
          plannedAmountMinor: "01",
          currencyCode: "USD",
        }),
      ],
      transactions: [
        transaction({ categoryId: "groceries", categoryType: "EXPENSE", amountMinor: "200" }),
        transaction({
          categoryId: "ignored-transaction",
          periodId: "10000000-0000-0000-0000-000000000002",
          amountMinor: "1e3",
          currencyCode: "USD",
        }),
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        income: { amount: { minorUnits: BigInt("1000") } },
        consumptionExpenses: { amount: { minorUnits: BigInt("200") } },
        availableBalance: { minorUnits: BigInt("800") },
      },
    });
  });
});
