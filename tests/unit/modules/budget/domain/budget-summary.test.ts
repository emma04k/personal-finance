import { describe, expect, it } from "vitest";
import {
  createCurrencyCode,
  money as signedMoney,
  nonNegativeMoney,
  type CurrencyCode,
  type Money,
} from "@/modules/finance/domain/money";
import { summarizeBudget } from "@/modules/budget/domain/budget-summary";

function currency(code = "USD"): CurrencyCode {
  const result = createCurrencyCode(code);
  if (!result.ok) throw new Error("Synthetic test currency must be supported");
  return result.value;
}

const units = (value: string) => BigInt(value);

function amount(minorUnits: bigint, code = currency()): Money {
  const result = nonNegativeMoney(minorUnits, code);
  if (!result.ok) throw new Error("Synthetic test amount must be valid");
  return result.value;
}

function signedAmount(minorUnits: bigint, code = currency()): Money {
  const result = signedMoney(minorUnits, code);
  if (!result.ok) throw new Error("Synthetic test amount must be valid");
  return result.value;
}

describe("budget summary", () => {
  it("separates spending from savings while computing cash outflow, rates, and balance", () => {
    const usd = currency();

    const result = summarizeBudget({
      currency: usd,
      income: [{ planned: amount(units("900"), usd), actual: amount(units("1000"), usd) }],
      consumptionExpenses: [
        { id: "housing", planned: amount(units("400"), usd), actual: amount(units("450"), usd) },
      ],
      debtPayments: [{ id: "card", planned: amount(units("100"), usd), actual: amount(units("100"), usd) }],
      savingsAllocations: [
        { id: "reserve", planned: amount(units("200"), usd), actual: amount(units("150"), usd) },
      ],
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        income: { amount: { minorUnits: units("1000"), currency: usd }, completeness: "complete", plannedValuesUsed: false },
        consumptionExpenses: { amount: { minorUnits: units("450"), currency: usd }, completeness: "complete", plannedValuesUsed: false },
        debtPayments: { amount: { minorUnits: units("100"), currency: usd }, completeness: "complete", plannedValuesUsed: false },
        savingsAllocations: { amount: { minorUnits: units("150"), currency: usd }, completeness: "complete", plannedValuesUsed: false },
        totalCashOutflow: { amount: { minorUnits: units("700"), currency: usd }, completeness: "complete", plannedValuesUsed: false },
        availableBalance: { minorUnits: units("300"), currency: usd },
        incomeVariance: { available: true, value: { minorUnits: units("100"), currency: usd } },
        expenseVariance: { available: true, value: { minorUnits: units("0"), currency: usd } },
      }),
    });

    if (!result.ok) throw new Error("Expected a valid synthetic summary");
    expect(result.value.totalOutflowRate).toMatchObject({
      available: true,
      ratio: { numerator: units("700"), denominator: units("1000") },
    });
    expect(result.value.consumptionDebtSpendRate).toMatchObject({
      available: true,
      ratio: { numerator: units("550"), denominator: units("1000") },
    });
    expect(result.value.savingsRate).toMatchObject({
      available: true,
      ratio: { numerator: units("150"), denominator: units("1000") },
    });
    expect(result.value.categoryUtilization).toEqual([
      { id: "housing", utilization: { available: true, ratio: { numerator: units("450"), denominator: units("400") } } },
      { id: "card", utilization: { available: true, ratio: { numerator: units("100"), denominator: units("100") } } },
      { id: "reserve", utilization: { available: true, ratio: { numerator: units("150"), denominator: units("200") } } },
    ]);
  });

  it("rejects signed negative source values while allowing signed calculated variances", () => {
    const usd = currency();

    expect(summarizeBudget({
      currency: usd,
      income: [{ planned: amount(units("100"), usd), actual: signedAmount(-units("1"), usd) }],
      consumptionExpenses: [],
      debtPayments: [],
      savingsAllocations: [],
    })).toEqual({ ok: false, error: { code: "NEGATIVE_BUDGET_AMOUNT", field: "actual" } });
  });

  it("keeps planned fallback and missing actual data visible in metadata", () => {
    const usd = currency();

    const result = summarizeBudget({
      currency: usd,
      income: [
        { planned: amount(units("1000"), usd), actual: null },
        { planned: null, actual: null },
      ],
      consumptionExpenses: [{ id: "food", planned: amount(units("300"), usd), actual: null }],
      debtPayments: [{ id: "loan", planned: amount(units("100"), usd), actual: amount(units("120"), usd) }],
      savingsAllocations: [{ id: "buffer", planned: amount(units("50"), usd), actual: amount(units("0"), usd) }],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        income: {
          amount: { minorUnits: units("1000"), currency: usd },
          completeness: "partial",
          plannedValuesUsed: true,
        },
        totalCashOutflow: {
          amount: { minorUnits: units("420"), currency: usd },
          completeness: "complete",
          plannedValuesUsed: true,
        },
        totalOutflowRate: { available: false, reason: "PARTIAL_DATA" },
        incomeVariance: { available: false, reason: "PARTIAL_DATA" },
        expenseVariance: { available: false, reason: "PARTIAL_DATA" },
      },
    });
  });

  it("treats partial zero-known income as partial data before zero income", () => {
    const usd = currency();

    const result = summarizeBudget({
      currency: usd,
      income: [
        { planned: amount(units("0"), usd), actual: amount(units("0"), usd) },
        { planned: null, actual: null },
      ],
      consumptionExpenses: [{ id: "food", planned: amount(units("10"), usd), actual: amount(units("10"), usd) }],
      debtPayments: [],
      savingsAllocations: [{ id: "buffer", planned: amount(units("0"), usd), actual: amount(units("0"), usd) }],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        income: { amount: { minorUnits: units("0"), currency: usd }, completeness: "partial" },
        totalOutflowRate: { available: false, reason: "PARTIAL_DATA" },
        consumptionDebtSpendRate: { available: false, reason: "PARTIAL_DATA" },
        savingsRate: { available: false, reason: "PARTIAL_DATA" },
      },
    });
  });

  it("returns unavailable income-based rates instead of infinity when income is zero", () => {
    const usd = currency();

    const result = summarizeBudget({
      currency: usd,
      income: [{ planned: amount(units("0"), usd), actual: amount(units("0"), usd) }],
      consumptionExpenses: [{ id: "food", planned: amount(units("10"), usd), actual: amount(units("10"), usd) }],
      debtPayments: [],
      savingsAllocations: [{ id: "buffer", planned: amount(units("0"), usd), actual: amount(units("0"), usd) }],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        income: { amount: { minorUnits: units("0"), currency: usd }, completeness: "complete" },
        totalOutflowRate: { available: false, reason: "ZERO_INCOME" },
        consumptionDebtSpendRate: { available: false, reason: "ZERO_INCOME" },
        savingsRate: { available: false, reason: "ZERO_INCOME" },
      },
    });
  });
});
