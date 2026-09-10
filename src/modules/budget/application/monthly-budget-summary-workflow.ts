import {
  summarizeBudget,
  type BudgetLine,
  type BudgetSummary,
  type BudgetSummaryError,
} from "@/modules/budget/domain/budget-summary";
import { createCurrencyCode, nonNegativeMoney, type Money } from "@/modules/finance/domain/money";
import { err, ok, type Result } from "@/modules/finance/domain/result";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "./owned-planning-repository";

type MonthlyBudgetSummaryAmountError = Readonly<{
  code: "INVALID_MONTHLY_SUMMARY_AMOUNT";
  field: "plannedAmountMinor" | "amountMinor";
}>;

export type MonthlyBudgetSummaryError = BudgetSummaryError | MonthlyBudgetSummaryAmountError;

const canonicalMinorUnits = /^(0|[1-9][0-9]*)$/;

type CategoryType = OwnedBudgetLine["categoryType"];

type CategorySummarySource = Readonly<{
  id: string;
  categoryType: CategoryType;
  planned: Money | null;
  actual: Money | null;
}>;

export function buildMonthlyBudgetSummary({
  period,
  plannedBudgetLines,
  transactions,
}: {
  readonly period: OwnedPeriod;
  readonly plannedBudgetLines: readonly OwnedBudgetLine[];
  readonly transactions: readonly OwnedTransaction[];
}): Result<BudgetSummary, MonthlyBudgetSummaryError> {
  const currency = createCurrencyCode(period.currencyCode);
  if (!currency.ok) return currency;

  const sources = new Map<string, CategorySummarySource>();

  for (const line of plannedBudgetLines.filter((entry) => entry.periodId === period.id)) {
    if (line.currencyCode !== period.currencyCode) {
      return err({ code: "CURRENCY_MISMATCH", field: "currency" });
    }
    const planned = sourceMoney(line.plannedAmountMinor, period.currencyCode, "plannedAmountMinor");
    if (!planned.ok) return planned;
    const existing = sources.get(line.categoryId);
    sources.set(line.categoryId, {
      id: line.categoryId,
      categoryType: line.categoryType,
      planned: planned.value,
      actual: existing?.actual ?? null,
    });
  }

  for (const transaction of transactions.filter((entry) => entry.periodId === period.id)) {
    if (transaction.currencyCode !== period.currencyCode) {
      return err({ code: "CURRENCY_MISMATCH", field: "currency" });
    }
    const actual = sourceMoney(transaction.amountMinor, period.currencyCode, "amountMinor");
    if (!actual.ok) return actual;
    const existing = sources.get(transaction.categoryId);
    sources.set(transaction.categoryId, {
      id: transaction.categoryId,
      categoryType: existing?.categoryType ?? transaction.categoryType,
      planned: existing?.planned ?? null,
      actual: existing?.actual ? addSourceMoney(existing.actual, actual.value) : actual.value,
    });
  }

  return summarizeBudget({
    currency: currency.value,
    income: budgetLinesForType(sources, "INCOME", false),
    consumptionExpenses: budgetLinesForType(sources, "EXPENSE", true),
    debtPayments: budgetLinesForType(sources, "DEBT_PAYMENT", true),
    savingsAllocations: budgetLinesForType(sources, "SAVINGS", true),
  });
}

function budgetLinesForType(
  sources: ReadonlyMap<string, CategorySummarySource>,
  categoryType: CategoryType,
  includeIds: boolean,
): BudgetLine[] {
  return [...sources.values()]
    .filter((source) => source.categoryType === categoryType)
    .map((source) => ({
      id: includeIds ? source.id : undefined,
      planned: source.planned,
      actual: source.actual,
    }));
}

function sourceMoney(
  minorUnits: string,
  currencyCode: string,
  field: MonthlyBudgetSummaryAmountError["field"],
): Result<Money, MonthlyBudgetSummaryError> {
  if (!canonicalMinorUnits.test(minorUnits)) {
    return err({ code: "INVALID_MONTHLY_SUMMARY_AMOUNT", field });
  }
  const currency = createCurrencyCode(currencyCode);
  if (!currency.ok) return currency;
  const value = nonNegativeMoney(BigInt(minorUnits), currency.value);
  return value.ok ? ok(value.value) : err({ code: "INVALID_MONTHLY_SUMMARY_AMOUNT", field });
}

function addSourceMoney(left: Money, right: Money): Money {
  const value = nonNegativeMoney(left.minorUnits + right.minorUnits, left.currency);
  if (!value.ok) throw new Error("validated source money must add without changing currency");
  return value.value;
}
