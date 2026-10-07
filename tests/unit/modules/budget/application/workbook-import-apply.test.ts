import { describe, expect, it } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import {
  InMemoryOwnedPlanningRepository,
  type OwnedCategory,
  type OwnedPeriod,
} from "@/modules/budget/application/owned-planning-repository";
import { applyPlannedWorkbookImport, applyWorkbookImport } from "@/modules/budget/application/workbook-import-apply";
import type { WorkbookImportPreview } from "@/modules/budget/application/workbook-import-preview";
import {
  InMemoryOwnedDebtAccountRepository,
  type OwnedDebtAccount,
} from "@/modules/debt/application/owned-debt-account-repository";

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

const existingIncomeCategory: OwnedCategory = {
  id: "20000000-0000-0000-0000-000000000001",
  userId: owner.userId,
  type: "INCOME",
  name: "Salary",
  sortOrder: 1,
  archivedAt: null,
};

const activeDebtAccount: OwnedDebtAccount = {
  id: "40000000-0000-0000-0000-000000000001",
  userId: owner.userId,
  name: "Synthetic credit card",
  creditorName: "Synthetic Bank",
  currentBalanceMinor: "900000",
  defaultRequiredPaymentMinor: "100000",
  currencyCode: "COP",
  status: "ACTIVE",
};

function preview(rows: WorkbookImportPreview["rows"], issues: WorkbookImportPreview["issues"] = []): WorkbookImportPreview {
  return { rows, issues };
}

describe("workbook import apply", () => {
  it("updates selected active owner debt account default payments from parsed debt diagnostic candidates without changing balances", async () => {
    const planningRepository = new InMemoryOwnedPlanningRepository({
      periods: [period],
      categories: [existingIncomeCategory],
      budgetLines: [],
      transactions: [],
    });
    const debtRepository = new InMemoryOwnedDebtAccountRepository({ accounts: [activeDebtAccount] });

    const result = await applyWorkbookImport({
      owner,
      planningRepository,
      debtRepository,
      period,
      preview: {
        rows: [],
        debtDiagnostic: {
          netIncome: null,
          paymentCandidates: [{ rowNumber: 6, label: "CUOTA TC", amountMinor: "1400000", currencyCode: "COP" }],
        },
        issues: [],
      },
      debtDefaultSelections: [{ candidateRowNumber: 6, debtAccountId: activeDebtAccount.id }],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        plannedRowsApplied: 0,
        categoriesCreated: 0,
        budgetLinesUpserted: 0,
        debtDefaultPaymentsUpdated: 1,
      },
    });
    expect(await debtRepository.listActiveDebtAccountsForOwner(owner.userId)).toEqual([
      {
        ...activeDebtAccount,
        defaultRequiredPaymentMinor: "1400000",
      },
    ]);
    expect(await planningRepository.listTransactionsForOwnerPeriod(owner.userId, period.id)).toEqual([]);
    expect(await planningRepository.listPlannedBudgetLinesForOwnerPeriod(owner.userId, period.id)).toEqual([]);
  });

  it("rejects duplicate debt diagnostic selections for the same workbook candidate before updating debt accounts", async () => {
    const debtRepository = new InMemoryOwnedDebtAccountRepository({ accounts: [activeDebtAccount] });

    const result = await applyWorkbookImport({
      owner,
      planningRepository: new InMemoryOwnedPlanningRepository({ periods: [period], categories: [], budgetLines: [], transactions: [] }),
      debtRepository,
      period,
      preview: {
        rows: [],
        debtDiagnostic: {
          netIncome: null,
          paymentCandidates: [{ rowNumber: 6, label: "CUOTA TC", amountMinor: "1400000", currencyCode: "COP" }],
        },
        issues: [],
      },
      debtDefaultSelections: [
        { candidateRowNumber: 6, debtAccountId: activeDebtAccount.id },
        { candidateRowNumber: 6, debtAccountId: activeDebtAccount.id },
      ],
    });

    expect(result).toEqual({ ok: false, error: { code: "INVALID_DEBT_ACCOUNT_SELECTION", field: "debtAccountId" } });
    expect(await debtRepository.listActiveDebtAccountsForOwner(owner.userId)).toEqual([activeDebtAccount]);
  });

  it("rejects invalid debt selections before creating planned categories or budget lines", async () => {
    const planningRepository = new InMemoryOwnedPlanningRepository({
      periods: [period],
      categories: [],
      budgetLines: [],
      transactions: [],
    });
    const debtRepository = new InMemoryOwnedDebtAccountRepository({ accounts: [] });

    const result = await applyWorkbookImport({
      owner,
      planningRepository,
      debtRepository,
      period,
      preview: {
        rows: [{ type: "planned-expense", rowNumber: 2, description: "Synthetic Rent", amountMinor: "120000", currencyCode: "COP" }],
        debtDiagnostic: {
          netIncome: null,
          paymentCandidates: [{ rowNumber: 6, label: "Synthetic debt", amountMinor: "1400000", currencyCode: "COP" }],
        },
        issues: [],
      },
      debtDefaultSelections: [{ candidateRowNumber: 6, debtAccountId: "40000000-0000-0000-0000-000000000999" }],
    });

    expect(result).toEqual({ ok: false, error: { code: "INVALID_DEBT_ACCOUNT_SELECTION", field: "debtAccountId" } });
    expect(await planningRepository.listActiveCategoriesForOwner(owner.userId)).toEqual([]);
    expect(await planningRepository.listPlannedBudgetLinesForOwnerPeriod(owner.userId, period.id)).toEqual([]);
  });

  it("validates every selected debt candidate before updating any account default", async () => {
    const secondDebtAccount: OwnedDebtAccount = {
      ...activeDebtAccount,
      id: "40000000-0000-0000-0000-000000000002",
      name: "Synthetic USD loan",
      currencyCode: "USD",
      defaultRequiredPaymentMinor: "200000",
    };
    const debtRepository = new InMemoryOwnedDebtAccountRepository({ accounts: [activeDebtAccount, secondDebtAccount] });

    const result = await applyWorkbookImport({
      owner,
      planningRepository: new InMemoryOwnedPlanningRepository({ periods: [period], categories: [], budgetLines: [], transactions: [] }),
      debtRepository,
      period,
      preview: {
        rows: [],
        debtDiagnostic: {
          netIncome: null,
          paymentCandidates: [
            { rowNumber: 6, label: "Synthetic COP debt", amountMinor: "1400000", currencyCode: "COP" },
            { rowNumber: 7, label: "Synthetic USD debt", amountMinor: "250000", currencyCode: "COP" },
          ],
        },
        issues: [],
      },
      debtDefaultSelections: [
        { candidateRowNumber: 6, debtAccountId: activeDebtAccount.id },
        { candidateRowNumber: 7, debtAccountId: secondDebtAccount.id },
      ],
    });

    expect(result).toEqual({ ok: false, error: { code: "CURRENCY_MISMATCH", field: "currencyCode" } });
    expect(await debtRepository.listActiveDebtAccountsForOwner(owner.userId)).toEqual([
      activeDebtAccount,
      secondDebtAccount,
    ]);
  });

  it("rejects missing, cross-owner, inactive, and currency-mismatched debt account selections safely", async () => {
    const workbookPreview: WorkbookImportPreview = {
      rows: [],
      debtDiagnostic: {
        netIncome: null,
        paymentCandidates: [{ rowNumber: 6, label: "CUOTA TC", amountMinor: "1400000", currencyCode: "COP" }],
      },
      issues: [],
    };
    const crossOwnerAccount: OwnedDebtAccount = { ...activeDebtAccount, userId: "00000000-0000-0000-0000-000000000999" };
    const inactiveAccount: OwnedDebtAccount = { ...activeDebtAccount, status: "CLOSED" };
    const usdAccount: OwnedDebtAccount = { ...activeDebtAccount, currencyCode: "USD" };

    for (const account of [crossOwnerAccount, inactiveAccount]) {
      const repository = new InMemoryOwnedDebtAccountRepository({ accounts: [account] });
      await expect(applyWorkbookImport({
        owner,
        planningRepository: new InMemoryOwnedPlanningRepository({ periods: [period], categories: [], budgetLines: [], transactions: [] }),
        debtRepository: repository,
        period,
        preview: workbookPreview,
        debtDefaultSelections: [{ candidateRowNumber: 6, debtAccountId: activeDebtAccount.id }],
      })).resolves.toEqual({ ok: false, error: { code: "INVALID_DEBT_ACCOUNT_SELECTION", field: "debtAccountId" } });
      expect(await repository.listActiveDebtAccountsForOwner(owner.userId)).toEqual([]);
    }

    const currencyMismatchRepository = new InMemoryOwnedDebtAccountRepository({ accounts: [usdAccount] });
    await expect(applyWorkbookImport({
      owner,
      planningRepository: new InMemoryOwnedPlanningRepository({ periods: [period], categories: [], budgetLines: [], transactions: [] }),
      debtRepository: currencyMismatchRepository,
      period,
      preview: workbookPreview,
      debtDefaultSelections: [{ candidateRowNumber: 6, debtAccountId: activeDebtAccount.id }],
    })).resolves.toEqual({ ok: false, error: { code: "CURRENCY_MISMATCH", field: "currencyCode" } });
    expect(await currencyMismatchRepository.listActiveDebtAccountsForOwner(owner.userId)).toEqual([usdAccount]);
  });
});

describe("planned workbook import apply", () => {
  it("creates missing planned categories, reuses existing categories, upserts planned lines, and skips actual rows", async () => {
    const repository = new InMemoryOwnedPlanningRepository({
      periods: [period],
      categories: [existingIncomeCategory],
      budgetLines: [{
        id: "30000000-0000-0000-0000-000000000001",
        userId: owner.userId,
        periodId: period.id,
        categoryId: existingIncomeCategory.id,
        categoryName: existingIncomeCategory.name,
        categoryType: existingIncomeCategory.type,
        plannedAmountMinor: "100000",
        currencyCode: "COP",
      }],
      transactions: [],
    });

    const result = await applyPlannedWorkbookImport({
      owner,
      repository,
      period,
      preview: preview([
        { type: "planned-income", rowNumber: 2, description: "Salary", amountMinor: "500000", currencyCode: "COP" },
        { type: "actual-income", rowNumber: 2, description: "Salary", amountMinor: "520000", currencyCode: "COP" },
        { type: "planned-expense", rowNumber: 2, description: "Rent", amountMinor: "120000", currencyCode: "COP" },
        { type: "actual-expense", rowNumber: 2, description: "Rent", amountMinor: "119000", currencyCode: "COP" },
      ]),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        plannedRowsApplied: 2,
        categoriesCreated: 1,
        budgetLinesUpserted: 2,
        debtDefaultPaymentsUpdated: 0,
      },
    });

    const categories = await repository.listActiveCategoriesForOwner(owner.userId);
    expect(categories).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: existingIncomeCategory.id, type: "INCOME", name: "Salary" }),
      expect.objectContaining({ type: "EXPENSE", name: "Rent" }),
    ]));

    const plannedLines = await repository.listPlannedBudgetLinesForOwnerPeriod(owner.userId, period.id);
    expect(plannedLines).toHaveLength(2);
    expect(plannedLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ categoryId: existingIncomeCategory.id, plannedAmountMinor: "500000", currencyCode: "COP" }),
      expect.objectContaining({ categoryName: "Rent", categoryType: "EXPENSE", plannedAmountMinor: "120000", currencyCode: "COP" }),
    ]));
    expect(await repository.listTransactionsForOwnerPeriod(owner.userId, period.id)).toEqual([]);
  });

  it("applies planned rows when the preview has debt-diagnostic-only issues", async () => {
    const repository = new InMemoryOwnedPlanningRepository({
      periods: [period],
      categories: [existingIncomeCategory],
      budgetLines: [],
      transactions: [],
    });

    const result = await applyPlannedWorkbookImport({
      owner,
      repository,
      period,
      preview: preview(
        [{ type: "planned-income", rowNumber: 2, description: "Salary", amountMinor: "500000", currencyCode: "COP" }],
        [{ code: "INVALID_MONEY", rowNumber: 5, type: "debt-payment-candidate" }],
      ),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        plannedRowsApplied: 1,
        categoriesCreated: 0,
        budgetLinesUpserted: 1,
        debtDefaultPaymentsUpdated: 0,
      },
    });
    expect(await repository.listPlannedBudgetLinesForOwnerPeriod(owner.userId, period.id)).toEqual([
      expect.objectContaining({ categoryId: existingIncomeCategory.id, plannedAmountMinor: "500000", currencyCode: "COP" }),
    ]);
  });
});
