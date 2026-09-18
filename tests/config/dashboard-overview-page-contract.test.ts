import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardPagePath = resolve("src/app/dashboard/page.tsx");
const appShellPath = resolve("src/components/app-shell.tsx");
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

describe("dashboard monthly overview page contract", () => {
  it("adds an owner-scoped /dashboard page built from the current displayed period", () => {
    expect(existsSync(dashboardPagePath)).toBe(true);
    const page = source(dashboardPagePath);

    expect(page).toMatch(/export default async function DashboardPage/);
    expect(page).toMatch(/<AppShell activeHref="\/dashboard">/);
    expect(page).toMatch(/requireCurrentOwnershipContext\(\)/);
    expect(page).toMatch(/new PrismaOwnedPlanningRepository\(prisma\)/);
    expect(page).toMatch(/listPeriodsForOwner\(owner\.userId\)/);
    expect(page).toMatch(/selectDisplayedBudgetPeriod\(\{[\s\S]*periods,[\s\S]*now:\s*new Date\(\),[\s\S]*timeZone:\s*DEFAULT_BUDGET_TIME_ZONE,?[\s\S]*\}\)/);
    expect(page).toMatch(/listPlannedBudgetLinesForOwnerPeriod\(owner\.userId, currentPeriod\.id\)/);
    expect(page).toMatch(/listTransactionsForOwnerPeriod\(owner\.userId, currentPeriod\.id\)/);
    expect(page).toMatch(/buildMonthlyBudgetSummary\(\{ period: currentPeriod, plannedBudgetLines, transactions \}\)/);
    expect(page).not.toMatch(/searchParams|params:\s*Promise|formData\.get\(["'](?:userId|periodId|currencyCode)["']\)|ownerUserId:\s*|name="(?:userId|periodId|currencyCode)"/);
  });

  it("exposes the dashboard from the app shell navigation", () => {
    const appShell = source(appShellPath);

    expect(appShell).toMatch(/\{ label: "Dashboard", href: "\/dashboard", icon: LayoutDashboard \}/);
    expect(appShell).toMatch(/activeHref === "\/dashboard"|item\.href === activeHref/);
  });

  it("renders current-period summary cards from existing deterministic summary outputs", () => {
    expect(existsSync(dashboardPagePath)).toBe(true);
    const page = source(dashboardPagePath);

    expect(page).toMatch(/aria-labelledby="dashboard-heading"/);
    expect(page).toMatch(/aria-label="Resumen mensual del periodo actual"/);
    expect(page).toMatch(/summary\.income\.amount/);
    expect(page).toMatch(/summary\.totalCashOutflow\.amount/);
    expect(page).toMatch(/summary\.availableBalance/);
    expect(page).toMatch(/summary\.totalOutflowRate|summary\.consumptionDebtSpendRate/);
    expect(page).toMatch(/formatMoney\(summary\.income\.amount\)/);
    expect(page).toMatch(/formatMoney\(summary\.totalCashOutflow\.amount\)/);
    expect(page).toMatch(/formatMaybeRate\(summary\.(?:totalOutflowRate|consumptionDebtSpendRate)\)/);
    expect(page).not.toMatch(/parseFloat|Number\(|toFixed\(|Math\.round\(/);
  });

  it("renders planned-versus-actual variance signals from existing summary outputs", () => {
    expect(existsSync(dashboardPagePath)).toBe(true);
    const page = source(dashboardPagePath);

    expect(page).toMatch(/aria-labelledby="dashboard-variance-heading"/);
    expect(page).toMatch(/id="dashboard-variance-heading">Variación planeado vs real<\/h2>/);
    expect(page).toMatch(/summary\.incomeVariance/);
    expect(page).toMatch(/summary\.expenseVariance/);
    expect(page).toMatch(/formatMaybeMoney\(summary\.incomeVariance\)/);
    expect(page).toMatch(/formatMaybeMoney\(summary\.expenseVariance\)/);
    expect(page).toMatch(/label="Variación de ingresos"/);
    expect(page).toMatch(/label="Variación de egresos"/);
  });

  it("shows accessible fallback text when variance data is partial or missing", () => {
    expect(existsSync(dashboardPagePath)).toBe(true);
    const page = source(dashboardPagePath);

    expect(page).toMatch(/detail=\{formatVarianceDetail\(summary\.incomeVariance, "income"\)\}/);
    expect(page).toMatch(/detail=\{formatVarianceDetail\(summary\.expenseVariance, "expense"\)\}/);
    expect(page).toMatch(/role=\{value\.available \? undefined : "status"\}/);
    expect(page).toMatch(/No disponible: faltan valores planeados o reales completos para comparar\./);
    expect(page).toMatch(/La variación compara importes reales menos planeados; úsala como señal descriptiva, no como recomendación financiera\./);
  });

  it("shows accessible empty and fail-closed states", () => {
    expect(existsSync(dashboardPagePath)).toBe(true);
    const page = source(dashboardPagePath);

    expect(page).toMatch(/status:\s*"authentication-required"/);
    expect(page).toMatch(/role="status"/);
    expect(page).toMatch(/No hay un periodo mensual activo para mostrar el dashboard\./);
    expect(page).toMatch(/No se pudo calcular el dashboard con seguridad\./);
    expect(page).toMatch(/!summaryResult\.ok/);
  });

  it("adds mobile-first dashboard CSS that cannot require horizontal scrolling", () => {
    const dashboardPage = declarationBlock(".dashboard-page");
    const dashboardHero = declarationBlock(".dashboard-hero,\n.dashboard-panel,\n.dashboard-card-grid");
    const dashboardCardGrid = declarationBlock(".dashboard-card-grid");
    const dashboardCard = declarationBlock(".dashboard-card");
    const dashboardCardText = declarationBlock(".dashboard-card p,\n.dashboard-card strong,\n.dashboard-card small");

    expect(dashboardPage).toMatch(/display:\s*grid\s*;/);
    expect(dashboardPage).toMatch(/min-width:\s*0\s*;/);
    expect(dashboardPage).toMatch(/max-width:\s*100%\s*;/);
    expect(dashboardHero).toMatch(/min-width:\s*0\s*;/);
    expect(dashboardHero).toMatch(/max-width:\s*100%\s*;/);
    expect(dashboardCardGrid).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
    expect(dashboardCard).toMatch(/min-width:\s*0\s*;/);
    expect(dashboardCardText).toMatch(/overflow-wrap:\s*anywhere\s*;/);
  });

  it("keeps variance signals mobile-first without chart, import, debt, or AI scope creep", () => {
    const page = source(dashboardPagePath);
    const varianceGrid = declarationBlock(".dashboard-variance-grid");

    expect(page).toMatch(/className="dashboard-variance-grid"/);
    expect(varianceGrid).toMatch(/display:\s*grid\s*;/);
    expect(varianceGrid).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
    expect(varianceGrid).toMatch(/min-width:\s*0\s*;/);
    expect(varianceGrid).toMatch(/max-width:\s*100%\s*;/);
    expect(page).not.toMatch(/\b(?:recharts|Chart|CSV|XLSX|PDF|import workbook|debt account|AI|advisor|provider)\b/i);
  });
});
