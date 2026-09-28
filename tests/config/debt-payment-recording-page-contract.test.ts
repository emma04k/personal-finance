import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const debtsPagePath = resolve("src/app/debts/page.tsx");
const debtsStatePath = resolve("src/app/debts/debt-account-list-state.ts");
const debtsActionsPath = resolve("src/app/debts/actions.ts");
const debtPaymentFormPath = resolve("src/app/debts/debt-payment-form.tsx");
const debtPaymentActionStatePath = resolve("src/app/debts/debt-payment-action-state.ts");

function source(path: string) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

describe("debt payment recording page contract", () => {
  it("renders an authenticated debt payment form without accepting a client owner id", () => {
    expect(existsSync(debtPaymentFormPath)).toBe(true);
    expect(existsSync(debtPaymentActionStatePath)).toBe(true);
    const page = source(debtsPagePath);
    const form = source(debtPaymentFormPath);
    const actions = source(debtsActionsPath);

    expect(page).toMatch(/<DebtPaymentForm accounts=\{paymentAccounts\} periods=\{paymentPeriods\} transactionCandidates=\{paymentTransactionCandidates\} \/>/);
    expect(page).toMatch(/toDebtPaymentFormAccount\(account\)/);
    expect(page).toMatch(/toDebtPaymentFormPeriod\(period\)/);
    expect(page).toMatch(/toDebtPaymentFormTransactionCandidate\(candidate\)/);
    expect(form).toMatch(/useActionState\(\s*recordDebtPaymentAction,\s*initialDebtPaymentActionState,?\s*\)/);
    expect(form).toMatch(/name="debtAccountId"/);
    expect(form).toMatch(/name="periodId"/);
    expect(form).toMatch(/name="linkedTransactionId"/);
    expect(form).toMatch(/name="amount"/);
    expect(form).toMatch(/name="paidOn"/);
    expect(form).toMatch(/name="requiredPaymentOverride"/);
    expect(form).toMatch(/name="notes"/);
    expect(form).not.toMatch(/name="userId"|value=\{[^}]*userId/);
    expect(actions).toMatch(/recordDebtPaymentAction/);
    expect(actions).toMatch(/requireCurrentOwnershipContext\(\)/);
    expect(actions).not.toMatch(/formData\.get\(["']userId["']\)/);
  });

  it("maps debt payment client props to narrow DTOs before crossing the client boundary", () => {
    const page = source(debtsPagePath);
    const form = source(debtPaymentFormPath);

    expect(form).toMatch(/export type DebtPaymentFormAccount = Readonly<\{\s+id: string;\s+name: string;\s+currencyCode: string;\s+\}>/);
    expect(form).toMatch(/export type DebtPaymentFormPeriod = Readonly<\{\s+id: string;\s+monthStart: string;\s+currencyCode: string;\s+\}>/);
    expect(form).toMatch(/export type DebtPaymentFormTransactionCandidate = Readonly<\{\s+id: string;\s+periodId: string;\s+occurredOn: string;\s+description: string;\s+amountMinor: string;\s+currencyCode: string;\s+categoryName: string \| null;\s+\}>/);
    expect(page).toMatch(/function toDebtPaymentFormAccount\(account: OwnedDebtAccount\): DebtPaymentFormAccount/);
    expect(page).toMatch(/function toDebtPaymentFormPeriod\(period: OwnedPeriod\): DebtPaymentFormPeriod/);
    expect(page).toMatch(/function toDebtPaymentFormTransactionCandidate\(candidate: OwnedDebtPaymentTransactionCandidate\): DebtPaymentFormTransactionCandidate/);
    expect(page).toMatch(/return \{\s+id: account\.id,\s+name: account\.name,\s+currencyCode: account\.currencyCode,\s+\};/);
    expect(page).toMatch(/return \{\s+id: period\.id,\s+monthStart: period\.monthStart,\s+currencyCode: period\.currencyCode,\s+\};/);
    expect(page).toMatch(/return \{\s+id: candidate\.id,\s+periodId: candidate\.periodId,\s+occurredOn: candidate\.occurredOn,\s+description: candidate\.description,\s+amountMinor: candidate\.amountMinor,\s+currencyCode: candidate\.currencyCode,\s+categoryName: candidate\.categoryName,\s+\};/);
  });

  it("loads monthly periods server-side from the authenticated owner context for payment recording", () => {
    const state = source(debtsStatePath);

    expect(state).toMatch(/new PrismaOwnedPlanningRepository\(prisma\)/);
    expect(state).toMatch(/listPeriodsForOwner\(owner\.userId\)/);
    expect(state).toMatch(/periods/);
  });

  it("renders owner-scoped debt payment history server-side with safe review fields and an empty state", () => {
    const page = source(debtsPagePath);
    const state = source(debtsStatePath);

    expect(state).toMatch(/new PrismaOwnedDebtPaymentRepository\(prisma\)/);
    expect(state).toMatch(/listDebtPaymentsForOwner\(owner\.userId\)/);
    expect(state).toMatch(/listDebtPaymentTransactionCandidatesForOwner\(owner\.userId\)/);
    expect(page).toMatch(/<DebtPaymentHistorySection payments=\{state\.paymentHistory\} \/>/);
    expect(page).toMatch(/function DebtPaymentHistorySection\(\{ payments \}/);
    expect(page).toMatch(/No debt payments are recorded yet\./);
    expect(page).toMatch(/payment\.accountLabel/);
    expect(page).toMatch(/formatMonthLabel\(payment\.periodMonthStart\)/);
    expect(page).toMatch(/formatCurrencyMinorUnits\(payment\.amountMinor, payment\.currencyCode\)/);
    expect(page).toMatch(/formatDateLabel\(payment\.paidOn\)/);
    expect(page).toMatch(/payment\.requiredPaymentOverrideMinor/);
    expect(page).toMatch(/payment\.notes/);
    expect(page).toMatch(/payment\.linkedTransaction/);
    expect(page).toMatch(/Linked transaction/);
    expect(page).toMatch(/payment\.linkedTransaction\.description/);
    expect(page).toMatch(/payment\.linkedTransaction\.occurredOn/);
    expect(page).not.toMatch(/payment\.userId|userId: payment|debtAccountId: payment|periodId: payment/);
  });

  it("keeps debt payment recording and history read-only without balance reduction, edit/delete, charts, imports, or integrations", () => {
    const page = source(debtsPagePath);
    const actions = source(debtsActionsPath);
    const form = source(debtPaymentFormPath);

    expect(`${page}\n${actions}\n${form}`).toMatch(/recordDebtPaymentAction/);
    expect(`${page}\n${actions}\n${form}`).not.toMatch(/deletePayment|editPayment|currentBalanceMinor\s*[-+]|recharts|Chart|CSV|XLSX|PDF|workbook|import job|advisor|provider|bank sync|external integration/i);
  });
});
