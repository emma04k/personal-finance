import {
  AuthenticationRequiredError,
  UserNotActiveError,
  type OwnershipContext,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import type {
  OwnedDebtAccount,
  OwnedDebtAccountRepository,
} from "@/modules/debt/application/owned-debt-account-repository";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedPlanningRepository,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import type {
  OwnedDebtPaymentHistoryEntry,
  OwnedDebtPaymentRepository,
} from "@/modules/debt/application/owned-debt-payment-repository";
import { buildMonthlyBudgetSummary } from "@/modules/budget/application/monthly-budget-summary-workflow";
import { diagnoseDebt, type DebtBand } from "@/modules/debt/domain/debt-diagnostic";
import { createCurrencyCode, nonNegativeMoney, type Money } from "@/modules/finance/domain/money";
import { PrismaOwnedDebtAccountRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-account-repository";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { PrismaOwnedDebtPaymentRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-payment-repository";
import { prisma } from "@/lib/prisma";

export type DebtAccountListState =
  | Readonly<{
      status: "authenticated";
      accounts: readonly OwnedDebtAccount[];
      periods: readonly OwnedPeriod[];
      paymentHistory: readonly OwnedDebtPaymentHistoryEntry[];
      diagnostic: DebtDiagnosticSummaryState;
    }>
  | Readonly<{ status: "authentication-required" }>;

export type DebtDiagnosticContributor = Readonly<{
  accountId: string;
  accountName: string;
  requiredPaymentMinor: string;
  currencyCode: string;
}>;

export type DebtDiagnosticPeriodSummary = Readonly<{
  id: string;
  label: string;
  monthStart: string;
  currencyCode: string;
}>;

export type DebtDiagnosticUnavailableReason =
  | "NO_MONTHLY_PERIOD"
  | "NO_ACTIVE_DEBT_ACCOUNTS"
  | "ACTUAL_INCOME_MISSING"
  | "ZERO_ACTUAL_INCOME"
  | "UNSUPPORTED_DIAGNOSTIC_DATA";

export type DebtDiagnosticSummaryState =
  | Readonly<{
      status: "available";
      period: DebtDiagnosticPeriodSummary;
      monthlyRequiredDebtPaymentTotalMinor: string;
      debtToIncomeRate: Readonly<{ numerator: string; denominator: string }>;
      debtBand: DebtBand;
      saferBandMonthlyReductionMinor: string;
      saferBandTargetBand: DebtBand;
      contributors: readonly DebtDiagnosticContributor[];
    }>
  | Readonly<{
      status: "unavailable";
      reason: DebtDiagnosticUnavailableReason;
      period?: DebtDiagnosticPeriodSummary;
      monthlyRequiredDebtPaymentTotalMinor?: string;
      contributors?: readonly DebtDiagnosticContributor[];
    }>;

type DebtAccountListStateDependencies = Readonly<{
  getOwner?: () => Promise<OwnershipContext>;
  repository?: Pick<OwnedDebtAccountRepository, "listActiveDebtAccountsForOwner">;
  planningRepository?: Pick<OwnedPlanningRepository,
    "listPeriodsForOwner" | "listPlannedBudgetLinesForOwnerPeriod" | "listTransactionsForOwnerPeriod"
  >;
  paymentRepository?: Pick<OwnedDebtPaymentRepository, "listDebtPaymentsForOwner">;
}>;

const canonicalMinorUnits = /^(0|[1-9][0-9]*)$/;

export async function loadDebtAccountListState(
  dependencies: DebtAccountListStateDependencies = {},
): Promise<DebtAccountListState> {
  const getOwner = dependencies.getOwner ?? requireCurrentOwnershipContext;
  const repository = dependencies.repository ?? new PrismaOwnedDebtAccountRepository(prisma);
  const planningRepository = dependencies.planningRepository ?? new PrismaOwnedPlanningRepository(prisma);
  const paymentRepository = dependencies.paymentRepository ?? new PrismaOwnedDebtPaymentRepository(prisma);

  try {
    const owner = await getOwner();
    const [accounts, periods, paymentHistory] = await Promise.all([
      repository.listActiveDebtAccountsForOwner(owner.userId),
      planningRepository.listPeriodsForOwner(owner.userId),
      paymentRepository.listDebtPaymentsForOwner(owner.userId),
    ]);
    const diagnostic = await buildDebtDiagnosticSummary({
      ownerUserId: owner.userId,
      accounts,
      periods,
      planningRepository,
    });
    return { status: "authenticated", accounts, periods, paymentHistory, diagnostic };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof UserNotActiveError
    ) {
      return { status: "authentication-required" };
    }

    throw error;
  }
}

async function buildDebtDiagnosticSummary({
  ownerUserId,
  accounts,
  periods,
  planningRepository,
}: {
  readonly ownerUserId: string;
  readonly accounts: readonly OwnedDebtAccount[];
  readonly periods: readonly OwnedPeriod[];
  readonly planningRepository: Pick<OwnedPlanningRepository,
    "listPlannedBudgetLinesForOwnerPeriod" | "listTransactionsForOwnerPeriod"
  >;
}): Promise<DebtDiagnosticSummaryState> {
  const selectedPeriod = selectLatestPeriod(periods);
  if (!selectedPeriod) return { status: "unavailable", reason: "NO_MONTHLY_PERIOD" };

  const period = toDiagnosticPeriod(selectedPeriod);
  if (accounts.length === 0) return { status: "unavailable", reason: "NO_ACTIVE_DEBT_ACCOUNTS", period };

  const contributors = accounts.map(toDiagnosticContributor);
  const requiredPayments = accounts.map((account) => accountRequiredPayment(account));
  if (requiredPayments.some((payment) => payment === null)) {
    return {
      status: "unavailable",
      reason: "UNSUPPORTED_DIAGNOSTIC_DATA",
      period,
      contributors,
    };
  }

  const [plannedBudgetLines, transactions] = await Promise.all([
    planningRepository.listPlannedBudgetLinesForOwnerPeriod(ownerUserId, selectedPeriod.id),
    planningRepository.listTransactionsForOwnerPeriod(ownerUserId, selectedPeriod.id),
  ]);
  return buildPeriodDiagnostic({
    period: selectedPeriod,
    plannedBudgetLines,
    transactions,
    requiredPayments: requiredPayments as readonly Money[],
    contributors,
  });
}

function buildPeriodDiagnostic({
  period,
  plannedBudgetLines,
  transactions,
  requiredPayments,
  contributors,
}: {
  readonly period: OwnedPeriod;
  readonly plannedBudgetLines: readonly OwnedBudgetLine[];
  readonly transactions: readonly OwnedTransaction[];
  readonly requiredPayments: readonly Money[];
  readonly contributors: readonly DebtDiagnosticContributor[];
}): DebtDiagnosticSummaryState {
  const periodSummary = toDiagnosticPeriod(period);
  const summary = buildMonthlyBudgetSummary({ period, plannedBudgetLines, transactions });
  if (!summary.ok) {
    return { status: "unavailable", reason: "UNSUPPORTED_DIAGNOSTIC_DATA", period: periodSummary, contributors };
  }

  const currency = createCurrencyCode(period.currencyCode);
  if (!currency.ok) {
    return { status: "unavailable", reason: "UNSUPPORTED_DIAGNOSTIC_DATA", period: periodSummary, contributors };
  }
  const monthlyIncome = summary.value.income.completeness === "complete" && !summary.value.income.plannedValuesUsed
    ? summary.value.income.amount
    : null;
  const diagnostic = diagnoseDebt({
    currency: currency.value,
    monthlyIncome,
    debtPayments: requiredPayments.map((amount, index) => ({
      id: contributors[index]?.accountId ?? `required-payment-${index}`,
      amount,
    })),
  });
  if (!diagnostic.ok) {
    return { status: "unavailable", reason: "UNSUPPORTED_DIAGNOSTIC_DATA", period: periodSummary, contributors };
  }

  const monthlyRequiredDebtPaymentTotalMinor = diagnostic.value.monthlyDebtPayments.minorUnits.toString();
  if (!diagnostic.value.debtToIncomeRate.available) {
    return {
      status: "unavailable",
      reason: diagnostic.value.debtToIncomeRate.reason === "ZERO_INCOME"
        ? "ZERO_ACTUAL_INCOME"
        : "ACTUAL_INCOME_MISSING",
      period: periodSummary,
      monthlyRequiredDebtPaymentTotalMinor,
      contributors,
    };
  }
  if (!diagnostic.value.debtBand.available || !diagnostic.value.saferBandMonthlyReduction.available) {
    return {
      status: "unavailable",
      reason: "UNSUPPORTED_DIAGNOSTIC_DATA",
      period: periodSummary,
      monthlyRequiredDebtPaymentTotalMinor,
      contributors,
    };
  }

  return {
    status: "available",
    period: periodSummary,
    monthlyRequiredDebtPaymentTotalMinor,
    debtToIncomeRate: {
      numerator: diagnostic.value.debtToIncomeRate.ratio.numerator.toString(),
      denominator: diagnostic.value.debtToIncomeRate.ratio.denominator.toString(),
    },
    debtBand: diagnostic.value.debtBand.band,
    saferBandMonthlyReductionMinor: diagnostic.value.saferBandMonthlyReduction.value.minorUnits.toString(),
    saferBandTargetBand: diagnostic.value.saferBandMonthlyReduction.targetBand,
    contributors,
  };
}

function selectLatestPeriod(periods: readonly OwnedPeriod[]): OwnedPeriod | null {
  return [...periods].sort((left, right) => {
    const monthOrder = right.monthStart.localeCompare(left.monthStart);
    if (monthOrder !== 0) return monthOrder;
    return left.id.localeCompare(right.id);
  })[0] ?? null;
}

function toDiagnosticPeriod(period: OwnedPeriod): DebtDiagnosticPeriodSummary {
  return {
    id: period.id,
    label: period.monthStart.slice(0, 7),
    monthStart: period.monthStart,
    currencyCode: period.currencyCode,
  };
}

function toDiagnosticContributor(account: OwnedDebtAccount): DebtDiagnosticContributor {
  return {
    accountId: account.id,
    accountName: account.name,
    requiredPaymentMinor: account.defaultRequiredPaymentMinor,
    currencyCode: account.currencyCode,
  };
}

function accountRequiredPayment(account: OwnedDebtAccount): Money | null {
  if (!canonicalMinorUnits.test(account.defaultRequiredPaymentMinor)) return null;
  const currency = createCurrencyCode(account.currencyCode);
  if (!currency.ok) return null;
  const amount = nonNegativeMoney(BigInt(account.defaultRequiredPaymentMinor), currency.value);
  return amount.ok ? amount.value : null;
}
