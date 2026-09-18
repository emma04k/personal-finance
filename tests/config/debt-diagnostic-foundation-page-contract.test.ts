import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const debtsPagePath = resolve("src/app/debts/page.tsx");
const debtsActionsPath = resolve("src/app/debts/actions.ts");
const debtsRoutePath = resolve("src/app/debts/route.ts");
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

describe("debt diagnostic foundation page contract", () => {
  it("replaces the generic placeholder with an AppShell debt diagnostic foundation page", () => {
    expect(existsSync(debtsPagePath)).toBe(true);
    const page = source(debtsPagePath);

    expect(page).not.toMatch(/PhasePlaceholder/);
    expect(page).toMatch(/<AppShell activeHref="\/debts">/);
    expect(page).toMatch(/aria-labelledby="debt-diagnostic-heading"/);
    expect(page).toMatch(/id="debt-diagnostic-heading">Debt diagnostic<\/h1>/);
    expect(page).toMatch(/monthly debt payments divided by monthly income/i);
    expect(page).toMatch(/descriptive signal, not financial advice/i);
  });

  it("renders all four labels from the deterministic debt band model", () => {
    const page = source(debtsPagePath);

    expect(page).toMatch(/import type \{ DebtBand \} from "@\/modules\/debt\/domain\/debt-diagnostic"/);
    expect(page).toMatch(/debtDiagnosticBands/);
    expect(page).toMatch(/band:\s*"stable"[\s\S]*label:\s*"Stable \/ ideal"/);
    expect(page).toMatch(/band:\s*"watch"[\s\S]*label:\s*"Watch \/ caution"/);
    expect(page).toMatch(/band:\s*"strained"[\s\S]*label:\s*"Strained \/ capacity exceeded"/);
    expect(page).toMatch(/band:\s*"critical"[\s\S]*label:\s*"Critical \/ over-indebted"/);
    expect(page).toMatch(/readonly band: DebtBand/);
    expect(page).toMatch(/aria-label="Debt diagnostic bands"/);
  });

  it("shows an accessible unavailable state without implying a calculation ran", () => {
    const page = source(debtsPagePath);

    expect(page).toMatch(/className="debt-empty-state" role="status"/);
    expect(page).toMatch(/aria-labelledby="debt-empty-heading"/);
    expect(page).toMatch(/No debt accounts are configured yet\./);
    expect(page).toMatch(/This page did not run a debt calculation\./);
    expect(page).toMatch(/Persisted debt account entry will arrive in a later phase/i);
    expect(page).not.toMatch(/calculated diagnostic|calculated result|your level is/i);
  });

  it("adds mobile-first debt page CSS that cannot require horizontal scrolling", () => {
    const debtPage = declarationBlock(".debt-page");
    const debtContainers = declarationBlock(".debt-hero,\n.debt-panel,\n.debt-empty-state");
    const debtBandGrid = declarationBlock(".debt-band-grid");
    const debtBandCard = declarationBlock(".debt-band-card");
    const debtBandCardText = declarationBlock(".debt-band-card p,\n.debt-band-card strong,\n.debt-band-card small");

    expect(debtPage).toMatch(/display:\s*grid\s*;/);
    expect(debtPage).toMatch(/min-width:\s*0\s*;/);
    expect(debtPage).toMatch(/max-width:\s*100%\s*;/);
    expect(debtContainers).toMatch(/min-width:\s*0\s*;/);
    expect(debtContainers).toMatch(/max-width:\s*100%\s*;/);
    expect(debtBandGrid).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
    expect(debtBandCard).toMatch(/min-width:\s*0\s*;/);
    expect(debtBandCardText).toMatch(/overflow-wrap:\s*anywhere\s*;/);
  });

  it("keeps the foundation page out of persistence, charts, imports, and AI scope", () => {
    const page = source(debtsPagePath);

    expect(existsSync(debtsActionsPath)).toBe(false);
    expect(existsSync(debtsRoutePath)).toBe(false);
    expect(page).not.toMatch(/@\/lib\/prisma|@prisma\/client|Prisma|repository|requireCurrentOwnershipContext|getServerSession|["']use server["']|formData|get\(["'](?:userId|debtAccountId|currencyCode)["']\)/);
    expect(page).not.toMatch(/\b(?:recharts|Chart|CSV|XLSX|PDF|workbook|import job|AI|advisor|provider|bank sync|external integration)\b/i);
  });
});
