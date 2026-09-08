import { createRatio, type ExactRatio } from "@/modules/finance/domain/ratio";
import {
  createCurrencyCode,
  money,
  sumMoney,
  type CurrencyCode,
  type CurrencyCodeError,
  type CurrencyMismatchError,
  type Money,
} from "@/modules/finance/domain/money";
import { err, ok, type Result } from "@/modules/finance/domain/result";

export type Completeness = "complete" | "partial" | "missing";
export type RateUnavailableReason = "INCOME_MISSING" | "ZERO_INCOME" | "PARTIAL_DATA" | "ZERO_PLANNED";
export type BudgetSummaryError = CurrencyCodeError | CurrencyMismatchError | Readonly<{
  code: "NEGATIVE_BUDGET_AMOUNT";
  field: "planned" | "actual";
}>;

export interface BudgetLine {
  readonly id?: string;
  readonly planned: Money | null;
  readonly actual: Money | null;
}

export interface BudgetSummaryInput {
  readonly currency: CurrencyCode;
  readonly income: readonly BudgetLine[];
  readonly consumptionExpenses: readonly BudgetLine[];
  readonly debtPayments: readonly BudgetLine[];
  readonly savingsAllocations: readonly BudgetLine[];
}

export interface AggregateMoney {
  readonly amount: Money;
  readonly completeness: Completeness;
  readonly plannedValuesUsed: boolean;
}

export type AvailableRate = Readonly<{ available: true; ratio: ExactRatio }>;
export type UnavailableRate = Readonly<{ available: false; reason: RateUnavailableReason }>;
export type MaybeRate = AvailableRate | UnavailableRate;
export type AvailableMoney = Readonly<{ available: true; value: Money }>;
export type UnavailableMoney = Readonly<{ available: false; reason: "PARTIAL_DATA" }>;
export type MaybeMoney = AvailableMoney | UnavailableMoney;

export interface CategoryUtilization {
  readonly id: string;
  readonly utilization: MaybeRate;
}

export interface BudgetSummary {
  readonly income: AggregateMoney;
  readonly consumptionExpenses: AggregateMoney;
  readonly debtPayments: AggregateMoney;
  readonly savingsAllocations: AggregateMoney;
  readonly totalCashOutflow: AggregateMoney;
  readonly availableBalance: Money;
  readonly totalOutflowRate: MaybeRate;
  readonly consumptionDebtSpendRate: MaybeRate;
  readonly savingsRate: MaybeRate;
  readonly incomeVariance: MaybeMoney;
  readonly expenseVariance: MaybeMoney;
  readonly categoryUtilization: readonly CategoryUtilization[];
}

function combineCompleteness(values: readonly Completeness[]): Completeness {
  if (values.every((value) => value === "complete")) return "complete";
  if (values.every((value) => value === "missing")) return "missing";
  return "partial";
}

function effectiveValue(line: BudgetLine): { readonly value: Money | null; readonly planned: boolean } {
  if (line.actual !== null) return { value: line.actual, planned: false };
  if (line.planned !== null) return { value: line.planned, planned: true };
  return { value: null, planned: false };
}

function validateSourceAmounts(lines: readonly BudgetLine[]): Result<void, BudgetSummaryError> {
  for (const line of lines) {
    if (line.planned !== null && line.planned.minorUnits < BigInt("0")) {
      return err({ code: "NEGATIVE_BUDGET_AMOUNT", field: "planned" });
    }
    if (line.actual !== null && line.actual.minorUnits < BigInt("0")) {
      return err({ code: "NEGATIVE_BUDGET_AMOUNT", field: "actual" });
    }
  }
  return ok(undefined);
}

function aggregate(
  lines: readonly BudgetLine[],
  currency: CurrencyCode,
): Result<AggregateMoney, BudgetSummaryError> {
  const validSourceAmounts = validateSourceAmounts(lines);
  if (!validSourceAmounts.ok) return validSourceAmounts;
  const selected = lines.map(effectiveValue);
  const values = selected.flatMap((entry) => entry.value === null ? [] : [entry.value]);
  const total = sumMoney(values, currency);
  if (!total.ok) return total;
  const completeness = lines.length > 0 && values.length === lines.length
    ? "complete"
    : values.length === 0
      ? "missing"
      : "partial";
  return ok(Object.freeze({
    amount: total.value,
    completeness,
    plannedValuesUsed: selected.some((entry) => entry.planned),
  }));
}

function aggregateKnownMoney(
  values: readonly Money[],
  currency: CurrencyCode,
): Result<Money, BudgetSummaryError> {
  return sumMoney(values, currency);
}

function signedAmount(value: bigint, currency: CurrencyCode): Money {
  const result = money(value, currency);
  if (!result.ok) throw new Error("validated currency must construct signed money");
  return result.value;
}

function addAggregates(
  aggregates: readonly AggregateMoney[],
  currency: CurrencyCode,
): Result<AggregateMoney, BudgetSummaryError> {
  const total = aggregateKnownMoney(aggregates.map((entry) => entry.amount), currency);
  if (!total.ok) return total;
  return ok(Object.freeze({
    amount: total.value,
    completeness: combineCompleteness(aggregates.map((entry) => entry.completeness)),
    plannedValuesUsed: aggregates.some((entry) => entry.plannedValuesUsed),
  }));
}

function rate(numerator: AggregateMoney, denominator: AggregateMoney): MaybeRate {
  if (denominator.completeness === "missing") return { available: false, reason: "INCOME_MISSING" };
  if (denominator.completeness !== "complete") return { available: false, reason: "PARTIAL_DATA" };
  if (denominator.amount.minorUnits === BigInt("0")) return { available: false, reason: "ZERO_INCOME" };
  if (numerator.completeness !== "complete") return { available: false, reason: "PARTIAL_DATA" };
  const ratio = createRatio(numerator.amount.minorUnits, denominator.amount.minorUnits);
  if (!ratio.ok) return { available: false, reason: "PARTIAL_DATA" };
  return { available: true, ratio: ratio.value };
}

function utilization(line: BudgetLine): MaybeRate {
  if (line.planned === null) return { available: false, reason: "PARTIAL_DATA" };
  if (line.planned.minorUnits === BigInt("0")) return { available: false, reason: "ZERO_PLANNED" };
  const selected = effectiveValue(line);
  if (selected.value === null) return { available: false, reason: "PARTIAL_DATA" };
  const ratio = createRatio(selected.value.minorUnits, line.planned.minorUnits);
  if (!ratio.ok) return { available: false, reason: "PARTIAL_DATA" };
  return { available: true, ratio: ratio.value };
}

function completeVariance(lines: readonly BudgetLine[], currency: CurrencyCode): Result<MaybeMoney, BudgetSummaryError> {
  if (lines.length === 0 || lines.some((line) => line.actual === null || line.planned === null)) {
    return ok({ available: false, reason: "PARTIAL_DATA" });
  }
  const actual = sumMoney(lines.map((line) => line.actual as Money), currency);
  if (!actual.ok) return actual;
  const planned = sumMoney(lines.map((line) => line.planned as Money), currency);
  if (!planned.ok) return planned;
  return ok({ available: true, value: signedAmount(actual.value.minorUnits - planned.value.minorUnits, currency) });
}

export function summarizeBudget(input: BudgetSummaryInput): Result<BudgetSummary, BudgetSummaryError> {
  const currency = createCurrencyCode(input.currency);
  if (!currency.ok) return currency;

  const income = aggregate(input.income, currency.value);
  if (!income.ok) return income;
  const consumptionExpenses = aggregate(input.consumptionExpenses, currency.value);
  if (!consumptionExpenses.ok) return consumptionExpenses;
  const debtPayments = aggregate(input.debtPayments, currency.value);
  if (!debtPayments.ok) return debtPayments;
  const savingsAllocations = aggregate(input.savingsAllocations, currency.value);
  if (!savingsAllocations.ok) return savingsAllocations;
  const totalCashOutflow = addAggregates(
    [consumptionExpenses.value, debtPayments.value, savingsAllocations.value],
    currency.value,
  );
  if (!totalCashOutflow.ok) return totalCashOutflow;

  const availableBalance = signedAmount(
    income.value.amount.minorUnits - totalCashOutflow.value.amount.minorUnits,
    currency.value,
  );
  const consumptionDebt = addAggregates([consumptionExpenses.value, debtPayments.value], currency.value);
  if (!consumptionDebt.ok) return consumptionDebt;
  const incomeVariance = completeVariance(input.income, currency.value);
  if (!incomeVariance.ok) return incomeVariance;
  const expenseVariance = completeVariance(
    [...input.consumptionExpenses, ...input.debtPayments, ...input.savingsAllocations],
    currency.value,
  );
  if (!expenseVariance.ok) return expenseVariance;

  return ok(Object.freeze({
    income: income.value,
    consumptionExpenses: consumptionExpenses.value,
    debtPayments: debtPayments.value,
    savingsAllocations: savingsAllocations.value,
    totalCashOutflow: totalCashOutflow.value,
    availableBalance,
    totalOutflowRate: rate(totalCashOutflow.value, income.value),
    consumptionDebtSpendRate: rate(consumptionDebt.value, income.value),
    savingsRate: rate(savingsAllocations.value, income.value),
    incomeVariance: incomeVariance.value,
    expenseVariance: expenseVariance.value,
    categoryUtilization: [
      ...input.consumptionExpenses,
      ...input.debtPayments,
      ...input.savingsAllocations,
    ].filter((line): line is BudgetLine & { readonly id: string } => typeof line.id === "string")
      .map((line) => ({ id: line.id, utilization: utilization(line) })),
  }));
}
