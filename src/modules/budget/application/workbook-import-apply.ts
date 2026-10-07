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

export type WorkbookImportApplyError = Readonly<{
  code: "BLOCKING_PREVIEW_ISSUES" | "CURRENCY_MISMATCH";
  field: "workbook" | "currencyCode";
}>;

export type WorkbookImportApplyResult = Readonly<{
  plannedRowsApplied: number;
  categoriesCreated: number;
  budgetLinesUpserted: number;
}>;

type PlannedWorkbookImportRepository = Pick<
  OwnedPlanningRepository,
  "listActiveCategoriesForOwner" | "createCategoryForOwner" | "upsertPlannedBudgetLineForOwner"
>;

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
  if (preview.issues.some(isBlockingPlannedImportIssue)) {
    return err({ code: "BLOCKING_PREVIEW_ISSUES", field: "workbook" });
  }

  const plannedRows = preview.rows.filter(isPlannedRow);
  if (plannedRows.some((row) => row.currencyCode !== period.currencyCode)) {
    return err({ code: "CURRENCY_MISMATCH", field: "currencyCode" });
  }

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

  return ok({
    plannedRowsApplied: plannedRows.length,
    categoriesCreated,
    budgetLinesUpserted: plannedRows.length,
  });
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
