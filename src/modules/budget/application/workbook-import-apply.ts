import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import { err, ok, type Result } from "@/modules/finance/domain/result";
import {
  DuplicateCategoryError,
  type OwnedCategory,
  type OwnedPeriod,
  type OwnedPlanningRepository,
} from "./owned-planning-repository";
import type {
  WorkbookImportIssue,
  WorkbookImportPreview,
  WorkbookImportPreviewRow,
} from "./workbook-import-preview";
import type { OwnedDebtAccountRepository } from "@/modules/debt/application/owned-debt-account-repository";

export type WorkbookImportApplyError = Readonly<{
  code: "BLOCKING_PREVIEW_ISSUES" | "CURRENCY_MISMATCH" | "INVALID_DEBT_ACCOUNT_SELECTION";
  field: "workbook" | "currencyCode" | "debtAccountId";
}>;

export type WorkbookImportApplyResult = Readonly<{
  plannedRowsApplied: number;
  categoriesCreated: number;
  budgetLinesUpserted: number;
  debtDefaultPaymentsUpdated: number;
}>;

export type WorkbookImportDebtDefaultSelection = Readonly<{
  candidateRowNumber: number;
  debtAccountId: string;
}>;

type PlannedWorkbookImportRepository = Pick<
  OwnedPlanningRepository,
  "listActiveCategoriesForOwner" | "createCategoryForOwner" | "upsertPlannedBudgetLineForOwner"
>;

type DebtWorkbookImportRepository = Pick<
  OwnedDebtAccountRepository,
  "listActiveDebtAccountsForOwner" | "updateDebtAccountDefaultPaymentForOwner"
>;

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function applyWorkbookImport({
  owner,
  planningRepository,
  debtRepository,
  period,
  preview,
  debtDefaultSelections = [],
}: {
  readonly owner: OwnershipContext;
  readonly planningRepository: PlannedWorkbookImportRepository;
  readonly debtRepository?: DebtWorkbookImportRepository;
  readonly period: OwnedPeriod;
  readonly preview: WorkbookImportPreview;
  readonly debtDefaultSelections?: readonly WorkbookImportDebtDefaultSelection[];
}): Promise<Result<WorkbookImportApplyResult, WorkbookImportApplyError>> {
  const plannedRows = validatePlannedWorkbookImport({ period, preview });
  if (!plannedRows.ok) return plannedRows;

  const debtDefaultValidation = await validateDebtDefaultSelections({
    ownerUserId: owner.userId,
    debtRepository,
    period,
    preview,
    selections: debtDefaultSelections,
  });
  if (!debtDefaultValidation.ok) return debtDefaultValidation;

  const plannedResult = await persistPlannedWorkbookRows({
    owner,
    repository: planningRepository,
    period,
    plannedRows: plannedRows.value,
  });

  let debtDefaultPaymentsUpdated = 0;
  for (const update of debtDefaultValidation.value) {
    const updated = await debtRepository?.updateDebtAccountDefaultPaymentForOwner(
      owner.userId,
      update.debtAccountId,
      update.defaultRequiredPaymentMinor,
    );
    if (!updated) return err({ code: "INVALID_DEBT_ACCOUNT_SELECTION", field: "debtAccountId" });
    debtDefaultPaymentsUpdated += 1;
  }

  return ok({ ...plannedResult, debtDefaultPaymentsUpdated });
}

type ValidatedDebtDefaultUpdate = Readonly<{
  debtAccountId: string;
  defaultRequiredPaymentMinor: string;
}>;

async function validateDebtDefaultSelections({
  ownerUserId,
  debtRepository,
  period,
  preview,
  selections,
}: {
  readonly ownerUserId: string;
  readonly debtRepository?: DebtWorkbookImportRepository;
  readonly period: OwnedPeriod;
  readonly preview: WorkbookImportPreview;
  readonly selections: readonly WorkbookImportDebtDefaultSelection[];
}): Promise<Result<readonly ValidatedDebtDefaultUpdate[], WorkbookImportApplyError>> {
  if (selections.length === 0) return ok([]);
  if (!debtRepository) return err({ code: "INVALID_DEBT_ACCOUNT_SELECTION", field: "debtAccountId" });

  const candidatesByRow = new Map((preview.debtDiagnostic?.paymentCandidates ?? []).map((candidate) => [candidate.rowNumber, candidate]));
  const accounts = await debtRepository.listActiveDebtAccountsForOwner(ownerUserId);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const selectedCandidateRows = new Set<number>();
  const updates: ValidatedDebtDefaultUpdate[] = [];

  for (const selection of selections) {
    if (selectedCandidateRows.has(selection.candidateRowNumber) || !canonicalUuid.test(selection.debtAccountId)) {
      return err({ code: "INVALID_DEBT_ACCOUNT_SELECTION", field: "debtAccountId" });
    }
    selectedCandidateRows.add(selection.candidateRowNumber);

    const candidate = candidatesByRow.get(selection.candidateRowNumber);
    const account = accountsById.get(selection.debtAccountId);
    if (!candidate || !account) return err({ code: "INVALID_DEBT_ACCOUNT_SELECTION", field: "debtAccountId" });
    if (candidate.currencyCode !== period.currencyCode || account.currencyCode !== period.currencyCode) {
      return err({ code: "CURRENCY_MISMATCH", field: "currencyCode" });
    }

    updates.push({ debtAccountId: account.id, defaultRequiredPaymentMinor: candidate.amountMinor });
  }

  return ok(updates);
}

export async function applyPlannedWorkbookImport({
  owner,
  repository,
  period,
  preview,
}: {
  readonly owner: OwnershipContext;
  readonly repository: PlannedWorkbookImportRepository;
  readonly period: OwnedPeriod;
  readonly preview: WorkbookImportPreview;
}): Promise<Result<WorkbookImportApplyResult, WorkbookImportApplyError>> {
  const plannedRows = validatePlannedWorkbookImport({ period, preview });
  if (!plannedRows.ok) return plannedRows;

  return ok(await persistPlannedWorkbookRows({ owner, repository, period, plannedRows: plannedRows.value }));
}

function validatePlannedWorkbookImport({
  period,
  preview,
}: {
  readonly period: OwnedPeriod;
  readonly preview: WorkbookImportPreview;
}): Result<readonly WorkbookImportPreviewRow[], WorkbookImportApplyError> {
  if (preview.issues.some(isBlockingPlannedImportIssue)) {
    return err({ code: "BLOCKING_PREVIEW_ISSUES", field: "workbook" });
  }

  const plannedRows = preview.rows.filter(isPlannedRow);
  if (plannedRows.some((row) => row.currencyCode !== period.currencyCode)) {
    return err({ code: "CURRENCY_MISMATCH", field: "currencyCode" });
  }

  return ok(plannedRows);
}

async function persistPlannedWorkbookRows({
  owner,
  repository,
  period,
  plannedRows,
}: {
  readonly owner: OwnershipContext;
  readonly repository: PlannedWorkbookImportRepository;
  readonly period: OwnedPeriod;
  readonly plannedRows: readonly WorkbookImportPreviewRow[];
}): Promise<WorkbookImportApplyResult> {
  const categoryCache = new Map<string, OwnedCategory>();
  for (const category of await repository.listActiveCategoriesForOwner(owner.userId)) {
    categoryCache.set(categoryKey(category.type, category.name), category);
  }

  let categoriesCreated = 0;
  for (const row of plannedRows) {
    const type = categoryTypeForRow(row);
    const category = await findOrCreateCategory({
      ownerUserId: owner.userId,
      repository,
      categoryCache,
      type,
      name: row.description,
    });
    if (category.created) categoriesCreated += 1;

    await repository.upsertPlannedBudgetLineForOwner(owner.userId, {
      periodId: period.id,
      categoryId: category.value.id,
      plannedAmountMinor: row.amountMinor,
      currencyCode: period.currencyCode,
    });
  }

  return {
    plannedRowsApplied: plannedRows.length,
    categoriesCreated,
    budgetLinesUpserted: plannedRows.length,
    debtDefaultPaymentsUpdated: 0,
  };
}

function isPlannedRow(row: WorkbookImportPreviewRow) {
  return row.type === "planned-income" || row.type === "planned-expense";
}

function isBlockingPlannedImportIssue(issue: WorkbookImportIssue) {
  if (issue.type === "debt-net-income" || issue.type === "debt-payment-candidate") return false;
  if (issue.sheetName === "DIAGNOSTICO DE DEUDA") return false;
  return true;
}

function categoryTypeForRow(row: WorkbookImportPreviewRow): "INCOME" | "EXPENSE" {
  return row.type === "planned-income" ? "INCOME" : "EXPENSE";
}

async function findOrCreateCategory({
  ownerUserId,
  repository,
  categoryCache,
  type,
  name,
}: {
  readonly ownerUserId: string;
  readonly repository: PlannedWorkbookImportRepository;
  readonly categoryCache: Map<string, OwnedCategory>;
  readonly type: "INCOME" | "EXPENSE";
  readonly name: string;
}): Promise<Readonly<{ value: OwnedCategory; created: boolean }>> {
  const key = categoryKey(type, name);
  const existing = categoryCache.get(key);
  if (existing) return { value: existing, created: false };

  try {
    const created = await repository.createCategoryForOwner(ownerUserId, { type, name });
    categoryCache.set(key, created);
    return { value: created, created: true };
  } catch (error) {
    if (!(error instanceof DuplicateCategoryError)) throw error;
    const categories = await repository.listActiveCategoriesForOwner(ownerUserId);
    const recovered = categories.find((category) => category.type === type && category.name === name);
    if (!recovered) throw error;
    categoryCache.set(key, recovered);
    return { value: recovered, created: false };
  }
}

function categoryKey(type: OwnedCategory["type"], name: string) {
  return `${type}\u0000${name}`;
}
