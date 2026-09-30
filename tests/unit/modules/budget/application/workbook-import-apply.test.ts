import { describe, expect, it } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import {
  InMemoryOwnedPlanningRepository,
  type OwnedCategory,
  type OwnedPeriod,
} from "@/modules/budget/application/owned-planning-repository";
import { applyPlannedWorkbookImport } from "@/modules/budget/application/workbook-import-apply";
import type { WorkbookImportPreview } from "@/modules/budget/application/workbook-import-preview";

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

function preview(rows: WorkbookImportPreview["rows"], issues: WorkbookImportPreview["issues"] = []): WorkbookImportPreview {
  return { rows, issues };
}

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
});
