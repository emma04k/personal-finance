import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { loadDebtAccountListState } from "@/app/debts/debt-account-list-state";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import type { OwnedDebtAccount } from "@/modules/debt/application/owned-debt-account-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";

function activeAccount(overrides: Partial<OwnedDebtAccount> = {}): OwnedDebtAccount {
  return {
    id: overrides.id ?? "10000000-0000-0000-0000-000000000001",
    userId: overrides.userId ?? ownerUserId,
    name: overrides.name ?? "Student loan",
    creditorName: overrides.creditorName ?? "Federal Servicer",
    currentBalanceMinor: overrides.currentBalanceMinor ?? "1250000",
    defaultRequiredPaymentMinor: overrides.defaultRequiredPaymentMinor ?? "15000",
    currencyCode: overrides.currencyCode ?? "USD",
    status: overrides.status ?? "ACTIVE",
  };
}

function period(overrides: Partial<OwnedPeriod> = {}): OwnedPeriod {
  return {
    id: overrides.id ?? "30000000-0000-0000-0000-000000000001",
    userId: overrides.userId ?? ownerUserId,
    monthStart: overrides.monthStart ?? "2026-09-01",
    currencyCode: overrides.currencyCode ?? "USD",
    timeZone: overrides.timeZone ?? "America/New_York",
    note: overrides.note ?? null,
  };
}

function plannedLine(overrides: Partial<OwnedBudgetLine> = {}): OwnedBudgetLine {
  return {
    id: overrides.id ?? "40000000-0000-0000-0000-000000000001",
    userId: overrides.userId ?? ownerUserId,
    periodId: overrides.periodId ?? "30000000-0000-0000-0000-000000000001",
    categoryId: overrides.categoryId ?? "salary",
    categoryName: overrides.categoryName ?? "Salary",
    categoryType: overrides.categoryType ?? "INCOME",
    plannedAmountMinor: overrides.plannedAmountMinor ?? "90000",
    currencyCode: overrides.currencyCode ?? "USD",
  };
}

function transaction(overrides: Partial<OwnedTransaction> = {}): OwnedTransaction {
  return {
    id: overrides.id ?? "50000000-0000-0000-0000-000000000001",
    userId: overrides.userId ?? ownerUserId,
    periodId: overrides.periodId ?? "30000000-0000-0000-0000-000000000001",
    categoryId: overrides.categoryId ?? "salary",
    categoryName: overrides.categoryName ?? "Salary",
    categoryType: overrides.categoryType ?? "INCOME",
    direction: overrides.direction ?? "INFLOW",
    amountMinor: overrides.amountMinor ?? "100000",
    currencyCode: overrides.currencyCode ?? "USD",
    occurredOn: overrides.occurredOn ?? "2026-09-15",
    description: overrides.description ?? "Synthetic income",
  };
}

function paymentHistoryEntry() {
  return {
    id: "20000000-0000-0000-0000-000000000001",
    accountLabel: "Student loan",
    periodMonthStart: "2026-09-01",
    amountMinor: "15025",
    currencyCode: "USD",
    paidOn: "2026-09-15",
    requiredPaymentOverrideMinor: null,
    notes: "September payment",
    linkedTransaction: null,
  };
}

function transactionCandidate() {
  return {
    id: "50000000-0000-0000-0000-000000000001",
    periodId: "30000000-0000-0000-0000-000000000001",
    occurredOn: "2026-09-15",
    description: "Student loan payment",
    amountMinor: "15025",
    currencyCode: "USD",
    categoryName: "Debt payment",
  };
}

describe("/debts account list state", () => {
  it("loads an owner-scoped debt diagnostic from active accounts, the latest period, and actual income", async () => {
    const accounts = [
      activeAccount({
        id: "10000000-0000-0000-0000-000000000002",
        name: "Auto loan",
        defaultRequiredPaymentMinor: "30000",
      }),
      activeAccount({
        id: "10000000-0000-0000-0000-000000000001",
        name: "Student loan",
        defaultRequiredPaymentMinor: "15000",
      }),
    ];
    const selectedPeriod = period({
      id: "30000000-0000-0000-0000-000000000001",
      monthStart: "2026-10-01",
    });
    const periods = [
      period({ id: "30000000-0000-0000-0000-000000000009", monthStart: "2026-09-01" }),
      period({ id: "30000000-0000-0000-0000-000000000002", monthStart: "2026-10-01" }),
      selectedPeriod,
    ];
    const paymentHistory = [paymentHistoryEntry()];
    const transactionCandidates = [transactionCandidate()];
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn().mockResolvedValue(accounts),
    };
    const planningRepository = {
      listPeriodsForOwner: vi.fn().mockResolvedValue(periods),
      listPlannedBudgetLinesForOwnerPeriod: vi.fn().mockResolvedValue([
        plannedLine({ periodId: selectedPeriod.id, categoryId: "salary", plannedAmountMinor: "90000" }),
      ]),
      listTransactionsForOwnerPeriod: vi.fn().mockResolvedValue([
        transaction({ periodId: selectedPeriod.id, categoryId: "salary", amountMinor: "100000" }),
      ]),
    };
    const paymentRepository = {
      listDebtPaymentsForOwner: vi.fn().mockResolvedValue(paymentHistory),
      listDebtPaymentTransactionCandidatesForOwner: vi.fn().mockResolvedValue(transactionCandidates),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => ({ userId: ownerUserId, role: "OWNER", email: "owner@example.com" }),
      repository,
      planningRepository,
      paymentRepository,
    })).resolves.toEqual({
      status: "authenticated",
      accounts,
      periods,
      paymentHistory,
      transactionCandidates,
      diagnostic: {
        status: "available",
        period: {
          id: selectedPeriod.id,
          label: "2026-10",
          monthStart: "2026-10-01",
          currencyCode: "USD",
        },
        monthlyRequiredDebtPaymentTotalMinor: "45000",
        debtToIncomeRate: { numerator: "45000", denominator: "100000" },
        debtBand: "strained",
        saferBandMonthlyReductionMinor: "5000",
        saferBandTargetBand: "watch",
        contributors: [
          {
            accountId: "10000000-0000-0000-0000-000000000002",
            accountName: "Auto loan",
            requiredPaymentMinor: "30000",
            currencyCode: "USD",
          },
          {
            accountId: "10000000-0000-0000-0000-000000000001",
            accountName: "Student loan",
            requiredPaymentMinor: "15000",
            currencyCode: "USD",
          },
        ],
      },
    });
    expect(repository.listActiveDebtAccountsForOwner).toHaveBeenCalledWith(ownerUserId);
    expect(planningRepository.listPeriodsForOwner).toHaveBeenCalledWith(ownerUserId);
    expect(planningRepository.listPlannedBudgetLinesForOwnerPeriod).toHaveBeenCalledWith(ownerUserId, selectedPeriod.id);
    expect(planningRepository.listTransactionsForOwnerPeriod).toHaveBeenCalledWith(ownerUserId, selectedPeriod.id);
    expect(paymentRepository.listDebtPaymentsForOwner).toHaveBeenCalledWith(ownerUserId);
    expect(paymentRepository.listDebtPaymentTransactionCandidatesForOwner).toHaveBeenCalledWith(ownerUserId);
  });

  it("marks the diagnostic unavailable when the owner has no monthly period", async () => {
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn().mockResolvedValue([activeAccount()]),
    };
    const planningRepository = {
      listPeriodsForOwner: vi.fn().mockResolvedValue([]),
      listPlannedBudgetLinesForOwnerPeriod: vi.fn(),
      listTransactionsForOwnerPeriod: vi.fn(),
    };
    const paymentRepository = {
      listDebtPaymentsForOwner: vi.fn().mockResolvedValue([]),
      listDebtPaymentTransactionCandidatesForOwner: vi.fn().mockResolvedValue([]),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => ({ userId: ownerUserId, role: "OWNER", email: "owner@example.com" }),
      repository,
      planningRepository,
      paymentRepository,
    })).resolves.toMatchObject({
      status: "authenticated",
      diagnostic: { status: "unavailable", reason: "NO_MONTHLY_PERIOD" },
    });
    expect(planningRepository.listPlannedBudgetLinesForOwnerPeriod).not.toHaveBeenCalled();
    expect(planningRepository.listTransactionsForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("marks the diagnostic unavailable when the owner has no active debt accounts", async () => {
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn().mockResolvedValue([]),
    };
    const planningRepository = {
      listPeriodsForOwner: vi.fn().mockResolvedValue([period()]),
      listPlannedBudgetLinesForOwnerPeriod: vi.fn(),
      listTransactionsForOwnerPeriod: vi.fn(),
    };
    const paymentRepository = {
      listDebtPaymentsForOwner: vi.fn().mockResolvedValue([]),
      listDebtPaymentTransactionCandidatesForOwner: vi.fn().mockResolvedValue([]),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => ({ userId: ownerUserId, role: "OWNER", email: "owner@example.com" }),
      repository,
      planningRepository,
      paymentRepository,
    })).resolves.toMatchObject({
      status: "authenticated",
      diagnostic: { status: "unavailable", reason: "NO_ACTIVE_DEBT_ACCOUNTS" },
    });
    expect(planningRepository.listPlannedBudgetLinesForOwnerPeriod).not.toHaveBeenCalled();
    expect(planningRepository.listTransactionsForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("does not use planned income as a fallback for the first diagnostic slice", async () => {
    const selectedPeriod = period();
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn().mockResolvedValue([activeAccount()]),
    };
    const planningRepository = {
      listPeriodsForOwner: vi.fn().mockResolvedValue([selectedPeriod]),
      listPlannedBudgetLinesForOwnerPeriod: vi.fn().mockResolvedValue([
        plannedLine({ periodId: selectedPeriod.id, plannedAmountMinor: "100000" }),
      ]),
      listTransactionsForOwnerPeriod: vi.fn().mockResolvedValue([]),
    };
    const paymentRepository = {
      listDebtPaymentsForOwner: vi.fn().mockResolvedValue([]),
      listDebtPaymentTransactionCandidatesForOwner: vi.fn().mockResolvedValue([]),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => ({ userId: ownerUserId, role: "OWNER", email: "owner@example.com" }),
      repository,
      planningRepository,
      paymentRepository,
    })).resolves.toMatchObject({
      status: "authenticated",
      diagnostic: {
        status: "unavailable",
        reason: "ACTUAL_INCOME_MISSING",
        period: { label: "2026-09", currencyCode: "USD" },
        monthlyRequiredDebtPaymentTotalMinor: "15000",
      },
    });
  });

  it("marks the diagnostic unavailable when actual income is intentionally zero", async () => {
    const selectedPeriod = period();
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn().mockResolvedValue([activeAccount()]),
    };
    const planningRepository = {
      listPeriodsForOwner: vi.fn().mockResolvedValue([selectedPeriod]),
      listPlannedBudgetLinesForOwnerPeriod: vi.fn().mockResolvedValue([]),
      listTransactionsForOwnerPeriod: vi.fn().mockResolvedValue([
        transaction({ periodId: selectedPeriod.id, amountMinor: "0" }),
      ]),
    };
    const paymentRepository = {
      listDebtPaymentsForOwner: vi.fn().mockResolvedValue([]),
      listDebtPaymentTransactionCandidatesForOwner: vi.fn().mockResolvedValue([]),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => ({ userId: ownerUserId, role: "OWNER", email: "owner@example.com" }),
      repository,
      planningRepository,
      paymentRepository,
    })).resolves.toMatchObject({
      status: "authenticated",
      diagnostic: {
        status: "unavailable",
        reason: "ZERO_ACTUAL_INCOME",
        period: { label: "2026-09", currencyCode: "USD" },
        monthlyRequiredDebtPaymentTotalMinor: "15000",
      },
    });
  });

  it("fails closed without querying repositories when authentication is missing", async () => {
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn(),
    };
    const planningRepository = {
      listPeriodsForOwner: vi.fn(),
      listPlannedBudgetLinesForOwnerPeriod: vi.fn(),
      listTransactionsForOwnerPeriod: vi.fn(),
    };
    const paymentRepository = {
      listDebtPaymentsForOwner: vi.fn(),
      listDebtPaymentTransactionCandidatesForOwner: vi.fn(),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => {
        throw new AuthenticationRequiredError();
      },
      repository,
      planningRepository,
      paymentRepository,
    })).resolves.toEqual({ status: "authentication-required" });
    expect(repository.listActiveDebtAccountsForOwner).not.toHaveBeenCalled();
    expect(planningRepository.listPeriodsForOwner).not.toHaveBeenCalled();
    expect(planningRepository.listPlannedBudgetLinesForOwnerPeriod).not.toHaveBeenCalled();
    expect(planningRepository.listTransactionsForOwnerPeriod).not.toHaveBeenCalled();
    expect(paymentRepository.listDebtPaymentsForOwner).not.toHaveBeenCalled();
  });

  it("fails closed without querying repositories when the owner is inactive", async () => {
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn(),
    };
    const planningRepository = {
      listPeriodsForOwner: vi.fn(),
      listPlannedBudgetLinesForOwnerPeriod: vi.fn(),
      listTransactionsForOwnerPeriod: vi.fn(),
    };
    const paymentRepository = {
      listDebtPaymentsForOwner: vi.fn(),
      listDebtPaymentTransactionCandidatesForOwner: vi.fn(),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => {
        throw new UserNotActiveError();
      },
      repository,
      planningRepository,
      paymentRepository,
    })).resolves.toEqual({ status: "authentication-required" });
    expect(repository.listActiveDebtAccountsForOwner).not.toHaveBeenCalled();
    expect(planningRepository.listPeriodsForOwner).not.toHaveBeenCalled();
    expect(planningRepository.listPlannedBudgetLinesForOwnerPeriod).not.toHaveBeenCalled();
    expect(planningRepository.listTransactionsForOwnerPeriod).not.toHaveBeenCalled();
    expect(paymentRepository.listDebtPaymentsForOwner).not.toHaveBeenCalled();
  });
});
