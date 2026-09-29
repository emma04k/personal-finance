import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const reportsPagePath = resolve("src/app/reports/page.tsx");
const reportsExportRoutePath = resolve("src/app/reports/export/route.ts");
const morePagePath = resolve("src/app/more/page.tsx");
const stylesheetPath = resolve("src/app/globals.css");

function source(path: string) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function declarationBlock(selector: string) {
  const stylesheet = source(stylesheetPath);
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));

  expect(match, `Missing CSS rule for ${selector}`).not.toBeNull();
  return match![1];
}

describe("monthly reports CSV export page contract", () => {
  it("adds a /reports page that loads one owner-scoped period and exposes a CSV export link", () => {
    expect(existsSync(reportsPagePath)).toBe(true);
    const page = source(reportsPagePath);

    expect(page).toMatch(/export default async function ReportsPage/);
    expect(page).toMatch(/searchParams:\s*Promise/);
    expect(page).toMatch(/<AppShell activeHref="\/more">/);
    expect(page).toMatch(/requireCurrentOwnershipContext\(\)/);
    expect(page).toMatch(/new PrismaOwnedPlanningRepository\(prisma\)/);
    expect(page).toMatch(/listPeriodsForOwner\(owner\.userId\)/);
    expect(page).toMatch(/selectDisplayedBudgetPeriod\(\{[\s\S]*periods,[\s\S]*now:\s*new Date\(\),[\s\S]*timeZone:\s*DEFAULT_BUDGET_TIME_ZONE,?[\s\S]*\}\)/);
    expect(page).toMatch(/canonicalUuid\.test\(selectedPeriodIdFromQuery\)/);
    expect(page).toMatch(/return \{ status: "authenticated", periods, selectedPeriod: undefined \}/);
    expect(page).toMatch(/findPeriodForOwner\(owner\.userId, selectedPeriodId\)/);
    expect(page).toMatch(/href=\{`\/reports\/export\?periodId=\$\{selectedPeriod\.id\}`\}/);
    expect(page).toMatch(/Descargar CSV/);
    expect(page).not.toMatch(/formData\.get\(["'](?:userId|ownerUserId)["']\)|name="(?:userId|ownerUserId)"|email:/);
  });

  it("renders monthly report context and safe unavailable states", () => {
    const page = source(reportsPagePath);

    expect(page).toMatch(/aria-labelledby="reports-heading"/);
    expect(page).toMatch(/Reporte mensual/);
    expect(page).toMatch(/Periodo seleccionado/);
    expect(page).toMatch(/selectedPeriod\.monthStart/);
    expect(page).toMatch(/selectedPeriod\.currencyCode/);
    expect(page).toMatch(/No hay un periodo mensual disponible para exportar\./);
    expect(page).toMatch(/Inicia sesión para exportar reportes\./);
  });

  it("exposes reports from the More area copy and defines the owner-scoped export route", () => {
    expect(existsSync(reportsExportRoutePath)).toBe(true);
    const morePage = source(morePagePath);
    const route = source(reportsExportRoutePath);

    expect(morePage).toMatch(/href="\/reports"/);
    expect(morePage).toMatch(/Reportes mensuales/);
    expect(route).toMatch(/requireCurrentOwnershipContext\(\)/);
    expect(route).toMatch(/findPeriodForOwner\(owner\.userId, periodId\)/);
    expect(route).toMatch(/listPlannedBudgetLinesForOwnerPeriod\(owner\.userId, period\.id\)/);
    expect(route).toMatch(/listTransactionsForOwnerPeriod\(owner\.userId, period\.id\)/);
    expect(route).toMatch(/Content-Disposition/);
    expect(route).toMatch(/Cache-Control/);
    expect(route).toMatch(/no-store/);
    expect(route).not.toMatch(/cookies\(|headers\(\)|password|credential/i);
  });

  it("adds mobile-first report page styles", () => {
    const reportsPage = declarationBlock(".reports-page");
    const reportsPanel = declarationBlock(".reports-panel");

    expect(reportsPage).toMatch(/display:\s*grid\s*;/);
    expect(reportsPage).toMatch(/min-width:\s*0\s*;/);
    expect(reportsPanel).toMatch(/min-width:\s*0\s*;/);
    expect(reportsPanel).toMatch(/overflow-wrap:\s*anywhere\s*;/);
  });
});
