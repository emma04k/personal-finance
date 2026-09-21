import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const debtsPagePath = resolve("src/app/debts/page.tsx");
const debtsStatePath = resolve("src/app/debts/debt-account-list-state.ts");
const debtRepositoryPath = resolve("src/modules/debt/application/owned-debt-account-repository.ts");
const prismaDebtRepositoryPath = resolve("src/modules/debt/infrastructure/prisma-owned-debt-account-repository.ts");
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

  it("shows an accessible authenticated empty state without implying a calculation ran", () => {
    const page = source(debtsPagePath);

    expect(page).toMatch(/className="debt-empty-state" role="status"/);
    expect(page).toMatch(/aria-labelledby="debt-empty-heading"/);
    expect(page).toMatch(/No debt accounts are configured yet\./);
    expect(page).toMatch(/This page did not run a debt calculation\./);
    expect(page).toMatch(/Add accounts in a later phase to review persisted balances here\./i);
    expect(page).not.toMatch(/calculated diagnostic|calculated result|your level is/i);
  });

  it("loads debt accounts server-side from the authenticated owner context", () => {
    const page = source(debtsPagePath);
    const state = source(debtsStatePath);

    expect(page).toMatch(/export default async function DebtsPage/);
    expect(page).toMatch(/loadDebtAccountListState\(\)/);
    expect(state).toMatch(/requireCurrentOwnershipContext/);
    expect(state).toMatch(/new PrismaOwnedDebtAccountRepository\(prisma\)/);
    expect(state).toMatch(/listActiveDebtAccountsForOwner\(owner\.userId\)/);
    expect(state).toMatch(/status:\s*"authentication-required"/);
  });

  it("renders persisted active account cards with safe formatted fields", () => {
    const page = source(debtsPagePath);

    expect(page).toMatch(/accounts\.map\(\(account\)/);
    expect(page).toMatch(/className="debt-account-card"/);
    expect(page).toMatch(/account\.name/);
    expect(page).toMatch(/account\.creditorName/);
    expect(page).toMatch(/formatCurrencyMinorUnits\(account\.currentBalanceMinor, account\.currencyCode\)/);
    expect(page).toMatch(/formatCurrencyMinorUnits\(account\.defaultRequiredPaymentMinor, account\.currencyCode\)/);
    expect(page).toMatch(/formatDebtAccountStatus\(account\.status\)/);
    expect(page).not.toMatch(/parseFloat|Number\(|toFixed\(|Math\.round\(/);
  });

  it("keeps unauthenticated users in a safe sign-in-required state", () => {
    const page = source(debtsPagePath);
    const state = source(debtsStatePath);

    expect(page).toMatch(/state\.status === "authentication-required"/);
    expect(page).toMatch(/Sign in to view debt accounts\./);
    expect(page).toMatch(/Debt accounts only load from an active authenticated owner session\./);
    expect(state).toMatch(/catch \(error\)/);
    expect(state).toMatch(/AuthenticationRequiredError/);
    expect(state).toMatch(/UserNotActiveError/);
  });

  it("defines owner-scoped read-only debt account repositories", () => {
    const repository = source(debtRepositoryPath);
    const prismaRepository = source(prismaDebtRepositoryPath);

    expect(repository).toMatch(/export type OwnedDebtAccount/);
    expect(repository).toMatch(/listActiveDebtAccountsForOwner/);
    expect(repository).toMatch(/account\.userId === ownerUserId && account\.status === "ACTIVE"/);
    expect(prismaRepository).toMatch(/where:\s*\{ userId: ownerUserId, status: "ACTIVE" \}/);
    expect(prismaRepository).toMatch(/currentBalanceMinor:\s*record\.currentBalanceMinor\.toString\(\)/);
    expect(prismaRepository).toMatch(/defaultRequiredPaymentMinor:\s*record\.defaultRequiredPaymentMinor\.toString\(\)/);
  });

  it("adds mobile-first debt page CSS that cannot require horizontal scrolling", () => {
    const debtPage = declarationBlock(".debt-page");
    const debtContainers = declarationBlock(".debt-hero,\n.debt-panel,\n.debt-empty-state");
    const debtBandGrid = declarationBlock(".debt-band-grid");
    const debtBandCard = declarationBlock(".debt-band-card");
    const debtBandCardText = declarationBlock(".debt-band-card p,\n.debt-band-card strong,\n.debt-band-card small");
    const debtAccountGrid = declarationBlock(".debt-account-grid");
    const debtAccountCard = declarationBlock(".debt-account-card");

    expect(debtPage).toMatch(/display:\s*grid\s*;/);
    expect(debtPage).toMatch(/min-width:\s*0\s*;/);
    expect(debtPage).toMatch(/max-width:\s*100%\s*;/);
    expect(debtContainers).toMatch(/min-width:\s*0\s*;/);
    expect(debtContainers).toMatch(/max-width:\s*100%\s*;/);
    expect(debtBandGrid).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
    expect(debtAccountGrid).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
    expect(debtBandCard).toMatch(/min-width:\s*0\s*;/);
    expect(debtAccountCard).toMatch(/min-width:\s*0\s*;/);
    expect(debtBandCardText).toMatch(/overflow-wrap:\s*anywhere\s*;/);
  });

  it("keeps the account list read-only without mutation, charts, imports, or AI scope", () => {
    const page = source(debtsPagePath);
    const state = source(debtsStatePath);

    expect(existsSync(debtsActionsPath)).toBe(false);
    expect(existsSync(debtsRoutePath)).toBe(false);
    expect(page).not.toMatch(/@\/lib\/prisma|@prisma\/client|getServerSession|["']use server["']|formData|get\(["'](?:userId|debtAccountId|currencyCode)["']\)/);
    expect(`${page}\n${state}`).not.toMatch(/\b(?:create|update|delete|archive|recordPayment|recharts|Chart|CSV|XLSX|PDF|workbook|import job|AI|advisor|provider|bank sync|external integration)\b/i);
  });
});
