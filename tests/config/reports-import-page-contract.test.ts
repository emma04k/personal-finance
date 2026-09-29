import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const importPagePath = resolve("src/app/reports/import/page.tsx");
const importActionsPath = resolve("src/app/reports/import/actions.ts");
const importFormPath = resolve("src/app/reports/import/workbook-import-preview-form.tsx");
const reportsPagePath = resolve("src/app/reports/page.tsx");

function source(path: string) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

describe("workbook import preview page contract", () => {
  it("adds an authenticated /reports/import entry point that loads owner-scoped periods", () => {
    expect(existsSync(importPagePath)).toBe(true);
    const page = source(importPagePath);

    expect(page).toMatch(/export default async function ReportsImportPage/);
    expect(page).toMatch(/<AppShell activeHref="\/more">/);
    expect(page).toMatch(/requireCurrentOwnershipContext\(\)/);
    expect(page).toMatch(/new PrismaOwnedPlanningRepository\(prisma\)/);
    expect(page).toMatch(/listPeriodsForOwner\(owner\.userId\)/);
    expect(page).toMatch(/selectDisplayedBudgetPeriod\(\{[\s\S]*periods,[\s\S]*now:\s*new Date\(\),[\s\S]*timeZone:\s*DEFAULT_BUDGET_TIME_ZONE,?[\s\S]*\}\)/);
    expect(page).toMatch(/WorkbookImportPreviewForm/);
    expect(page).not.toMatch(/ownerUserId|email:|cookies\(|headers\(|password|credential/i);
  });

  it("renders the upload constraints and safe unavailable states", () => {
    const page = source(importPagePath);
    const form = source(importFormPath);

    expect(page).toMatch(/Previsualizar importación/);
    expect(page).toMatch(/Formato Presupuesto/);
    expect(page).toMatch(/Inicia sesión para previsualizar importaciones\./);
    expect(page).toMatch(/No hay un periodo mensual disponible para previsualizar\./);
    expect(form).toMatch(/name="periodId"/);
    expect(form).toMatch(/name="workbook"/);
    expect(form).toMatch(/accept="\.xlsx"/);
    expect(form).toMatch(/type="file"/);
    expect(form).toMatch(/planned-income|Ingreso planeado/);
    expect(form).toMatch(/actual-income|Ingreso real/);
    expect(form).toMatch(/planned-expense|Gasto planeado/);
    expect(form).toMatch(/actual-expense|Gasto real/);
    expect(`${page}\n${form}`).not.toMatch(/dangerouslySetInnerHTML|eval\(|localStorage|sessionStorage|document\.cookie/i);
  });

  it("links the import preview from the reports page", () => {
    const reportsPage = source(reportsPagePath);

    expect(reportsPage).toMatch(/href="\/reports\/import"|href=\{`\/reports\/import`\}/);
    expect(reportsPage).toMatch(/Importar XLSX|Previsualizar importación/);
  });

  it("keeps preview action side-effect free and owner-authorized", () => {
    expect(existsSync(importActionsPath)).toBe(true);
    const actions = source(importActionsPath);

    expect(actions).toMatch(/"use server"/);
    expect(actions).toMatch(/requireCurrentOwnershipContext\(\)/);
    expect(actions).toMatch(/canonicalUuid\.test\(periodId\)/);
    expect(actions).toMatch(/findPeriodForOwner\(owner\.userId, periodId\)/);
    expect(actions).toMatch(/parseWorkbookImportPreview\(\{[\s\S]*currencyCode:\s*period\.currencyCode[\s\S]*\}\)/);
    expect(actions).not.toMatch(/createCategoryForOwner|upsertPlannedBudgetLineForOwner|createTransactionForOwner|update[A-Za-z]+ForOwner|delete[A-Za-z]+ForOwner|revalidatePath/);
  });
});
