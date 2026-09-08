import {
  createCurrencyCode,
  money,
  sumMoney,
  type CurrencyCode,
  type CurrencyCodeError,
  type CurrencyMismatchError,
  type Money,
} from "@/modules/finance/domain/money";
import { createRatio, type ExactRatio } from "@/modules/finance/domain/ratio";
import { err, ok, type Result } from "@/modules/finance/domain/result";

export type DebtBand = "stable" | "watch" | "strained" | "critical";
export type DebtUnavailableReason = "INCOME_MISSING" | "ZERO_INCOME";
export type DebtDiagnosticError = CurrencyCodeError | CurrencyMismatchError | Readonly<{
  code:
    | "INVALID_DEBT_LINK"
    | "DUPLICATE_DEBT_PAYMENT"
    | "DUPLICATE_TRANSACTION"
    | "NEGATIVE_DEBT_INCOME"
    | "NEGATIVE_DEBT_PAYMENT";
  field: "linkedTransactionId" | "id" | "monthlyIncome" | "amount";
}>;

export interface DebtPayment {
  readonly id: string;
  readonly amount: Money;
  readonly linkedTransactionId?: string;
}

export interface DebtTransaction {
  readonly id: string;
  readonly amount: Money;
}

export interface DebtDiagnosticInput {
  readonly currency: CurrencyCode;
  readonly monthlyIncome: Money | null;
  readonly debtPayments: readonly DebtPayment[];
  readonly transactions?: readonly DebtTransaction[];
}

export type AvailableDebtRate = Readonly<{ available: true; ratio: ExactRatio }>;
export type UnavailableDebtRate = Readonly<{ available: false; reason: DebtUnavailableReason }>;
export type MaybeDebtRate = AvailableDebtRate | UnavailableDebtRate;
export type AvailableDebtBand = Readonly<{ available: true; band: DebtBand }>;
export type UnavailableDebtBand = Readonly<{ available: false; reason: DebtUnavailableReason }>;
export type MaybeDebtBand = AvailableDebtBand | UnavailableDebtBand;
export type AvailableReduction = Readonly<{ available: true; value: Money; targetBand: DebtBand }>;
export type UnavailableReduction = Readonly<{ available: false; reason: DebtUnavailableReason }>;
export type MaybeReduction = AvailableReduction | UnavailableReduction;

export interface DebtDiagnostic {
  readonly monthlyDebtPayments: Money;
  readonly debtToIncomeRate: MaybeDebtRate;
  readonly debtBand: MaybeDebtBand;
  readonly saferBandMonthlyReduction: MaybeReduction;
}

const ZERO = BigInt("0");
const ONE_HUNDRED = BigInt("100");

function signedAmount(value: bigint, currency: CurrencyCode): Money {
  const result = money(value, currency);
  if (!result.ok) throw new Error("validated currency must construct signed money");
  return result.value;
}

function classifyRatio(ratio: ExactRatio): DebtBand {
  const scaled = ratio.numerator * ONE_HUNDRED;
  if (scaled <= ratio.denominator * BigInt("30")) return "stable";
  if (scaled <= ratio.denominator * BigInt("40")) return "watch";
  if (scaled <= ratio.denominator * BigInt("60")) return "strained";
  return "critical";
}

function saferTarget(band: DebtBand): { readonly band: DebtBand; readonly ceilingPercent: bigint } {
  if (band === "critical") return { band: "strained", ceilingPercent: BigInt("60") };
  if (band === "strained") return { band: "watch", ceilingPercent: BigInt("40") };
  return { band: "stable", ceilingPercent: BigInt("30") };
}

function unavailable(reason: DebtUnavailableReason): {
  readonly rate: UnavailableDebtRate;
  readonly band: UnavailableDebtBand;
  readonly reduction: UnavailableReduction;
} {
  return {
    rate: { available: false, reason },
    band: { available: false, reason },
    reduction: { available: false, reason },
  };
}

function uniqueIds(items: readonly { readonly id: string }[], code: "DUPLICATE_DEBT_PAYMENT" | "DUPLICATE_TRANSACTION"):
  Result<void, DebtDiagnosticError> {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) return err({ code, field: "id" });
    seen.add(item.id);
  }
  return ok(undefined);
}

function totalDebtPayments(
  payments: readonly DebtPayment[],
  transactions: readonly DebtTransaction[],
  currency: CurrencyCode,
): Result<Money, DebtDiagnosticError> {
  const uniquePayments = uniqueIds(payments, "DUPLICATE_DEBT_PAYMENT");
  if (!uniquePayments.ok) return uniquePayments;
  const uniqueTransactions = uniqueIds(transactions, "DUPLICATE_TRANSACTION");
  if (!uniqueTransactions.ok) return uniqueTransactions;

  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  for (const transaction of transactions) {
    const transactionCurrency = createCurrencyCode(transaction.amount.currency);
    if (!transactionCurrency.ok) return transactionCurrency;
    if (transactionCurrency.value !== currency) return err({ code: "CURRENCY_MISMATCH", field: "currency" });
    if (transaction.amount.minorUnits < ZERO) return err({ code: "NEGATIVE_DEBT_PAYMENT", field: "amount" });
  }
  const linked = new Set<string>();
  for (const payment of payments) {
    const paymentCurrency = createCurrencyCode(payment.amount.currency);
    if (!paymentCurrency.ok) return paymentCurrency;
    if (paymentCurrency.value !== currency) return err({ code: "CURRENCY_MISMATCH", field: "currency" });
    if (payment.amount.minorUnits < ZERO) return err({ code: "NEGATIVE_DEBT_PAYMENT", field: "amount" });
    if (payment.linkedTransactionId === undefined) continue;
    if (linked.has(payment.linkedTransactionId)) return err({ code: "INVALID_DEBT_LINK", field: "linkedTransactionId" });
    linked.add(payment.linkedTransactionId);
    const transaction = transactionById.get(payment.linkedTransactionId);
    if (!transaction) return err({ code: "INVALID_DEBT_LINK", field: "linkedTransactionId" });
    const transactionCurrency = createCurrencyCode(transaction.amount.currency);
    if (!transactionCurrency.ok) return transactionCurrency;
    if (transactionCurrency.value !== currency || transaction.amount.minorUnits !== payment.amount.minorUnits) {
      return err({ code: "INVALID_DEBT_LINK", field: "linkedTransactionId" });
    }
  }

  const unlinkedTransactions = transactions.filter((transaction) => !linked.has(transaction.id));
  return sumMoney([
    ...payments.map((payment) => payment.amount),
    ...unlinkedTransactions.map((transaction) => transaction.amount),
  ], currency);
}

export function diagnoseDebt(input: DebtDiagnosticInput): Result<DebtDiagnostic, DebtDiagnosticError> {
  const currency = createCurrencyCode(input.currency);
  if (!currency.ok) return currency;
  const monthlyDebtPayments = totalDebtPayments(input.debtPayments, input.transactions ?? [], currency.value);
  if (!monthlyDebtPayments.ok) return monthlyDebtPayments;

  if (input.monthlyIncome === null) {
    const state = unavailable("INCOME_MISSING");
    return ok({
      monthlyDebtPayments: monthlyDebtPayments.value,
      debtToIncomeRate: state.rate,
      debtBand: state.band,
      saferBandMonthlyReduction: state.reduction,
    });
  }
  const incomeCurrency = createCurrencyCode(input.monthlyIncome.currency);
  if (!incomeCurrency.ok) return incomeCurrency;
  if (incomeCurrency.value !== currency.value) return err({ code: "CURRENCY_MISMATCH", field: "currency" });
  if (input.monthlyIncome.minorUnits < ZERO) {
    return err({ code: "NEGATIVE_DEBT_INCOME", field: "monthlyIncome" });
  }
  if (input.monthlyIncome.minorUnits === ZERO) {
    const state = unavailable("ZERO_INCOME");
    return ok({
      monthlyDebtPayments: monthlyDebtPayments.value,
      debtToIncomeRate: state.rate,
      debtBand: state.band,
      saferBandMonthlyReduction: state.reduction,
    });
  }

  const ratio = createRatio(monthlyDebtPayments.value.minorUnits, input.monthlyIncome.minorUnits);
  if (!ratio.ok) {
    const state = unavailable("ZERO_INCOME");
    return ok({
      monthlyDebtPayments: monthlyDebtPayments.value,
      debtToIncomeRate: state.rate,
      debtBand: state.band,
      saferBandMonthlyReduction: state.reduction,
    });
  }
  const band = classifyRatio(ratio.value);
  const target = saferTarget(band);
  const safeLimit = input.monthlyIncome.minorUnits * target.ceilingPercent / ONE_HUNDRED;
  const reduction = monthlyDebtPayments.value.minorUnits > safeLimit
    ? monthlyDebtPayments.value.minorUnits - safeLimit
    : ZERO;

  return ok(Object.freeze({
    monthlyDebtPayments: monthlyDebtPayments.value,
    debtToIncomeRate: { available: true as const, ratio: ratio.value },
    debtBand: { available: true as const, band },
    saferBandMonthlyReduction: {
      available: true as const,
      value: signedAmount(reduction, currency.value),
      targetBand: target.band,
    },
  }));
}
