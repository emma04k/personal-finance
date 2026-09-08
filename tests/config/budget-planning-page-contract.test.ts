import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve("src/app/budget/page.tsx");
const actionPath = resolve("src/app/budget/actions.ts");
const actionStatePath = resolve("src/app/budget/budget-period-action-state.ts");
const formPath = resolve("src/app/budget/budget-period-form.tsx");
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

describe("budget planning page contract", () => {
  it("replaces the phase placeholder with an authenticated owner-scoped planning page", () => {
    const page = source(pagePath);

    expect(page).not.toMatch(/PhasePlaceholder/);
    expect(page).toMatch(/requireCurrentOwnershipContext/);
    expect(page).toMatch(/new PrismaOwnedPlanningRepository\(prisma\)/);
    expect(page).toMatch(/listPeriodsForOwner\(owner\.userId\)/);
    expect(page).toMatch(/listActiveCategoriesForOwner\(owner\.userId\)/);
    expect(page).toMatch(/<AppShell activeHref="\/budget">/);
    expect(page).toMatch(/aria-labelledby="budget-heading"/);
    expect(page).toMatch(/BudgetPeriodForm/);
  });

  it("offers explicit month currency and timezone inputs without client-provided owner ids", () => {
    const page = `${source(pagePath)}\n${source(formPath)}`;

    expect(page).toMatch(/htmlFor="period-month"/);
    expect(page).toMatch(/name="monthStart"/);
    expect(page).toMatch(/type="month"/);
    expect(page).toMatch(/htmlFor="period-currency"/);
    expect(page).toMatch(/name="currencyCode"/);
    expect(page).toMatch(/htmlFor="period-time-zone"/);
    expect(page).toMatch(/name="timeZone"/);
    expect(page).not.toMatch(/name="userId"|userId:\s*formData\.get|formData\.get\(["']userId["']\)/);
  });

  it("keeps the server mutation fail-closed and owner-derived", () => {
    expect(existsSync(actionPath)).toBe(true);
    const action = source(actionPath);

    expect(action).toMatch(/["']use server["']/);
    expect(action).toMatch(/requireCurrentOwnershipContext\(\)/);
    expect(action).toMatch(/new PrismaOwnedPlanningRepository\(prisma\)/);
    expect(action).toMatch(/openMonthlyBudgetPeriod/);
    expect(action).toMatch(/revalidatePath\("\/budget"\)/);
    expect(action).not.toMatch(/formData\.get\(["']userId["']\)|userId:\s*formData|getServerSession/);
  });

  it("uses a typed action-state contract for period creation feedback", () => {
    expect(existsSync(actionPath)).toBe(true);
    expect(existsSync(actionStatePath)).toBe(true);
    const action = source(actionPath);
    const actionState = source(actionStatePath);

    expect(actionState).toMatch(/export type BudgetPeriodActionState/);
    expect(actionState).toMatch(/export const initialBudgetPeriodActionState/);
    expect(action).toMatch(/import type \{[\s\S]*BudgetPeriodActionState/);
    expect(action).toMatch(/previousState:\s*BudgetPeriodActionState/);
    expect(action).toMatch(/formData:\s*FormData/);
    expect(action).toMatch(/status:\s*"error"/);
    expect(action).toMatch(/fieldErrors/);
    expect(action).toMatch(/status:\s*"success"/);
    expect(action).toMatch(/message/);
  });

  it("renders accessible inline period-form feedback through useActionState", () => {
    const page = source(pagePath);
    expect(page).toMatch(/BudgetPeriodForm/);
    expect(existsSync(formPath)).toBe(true);

    const form = source(formPath);

    expect(form).toMatch(/["']use client["']/);
    expect(form).toMatch(/useActionState\(createBudgetPeriodAction, initialBudgetPeriodActionState\)/);
    expect(form).toMatch(/<form className="budget-period-form" action=\{action\}/);
    expect(form).toMatch(/aria-live="polite"/);
    expect(form).toMatch(/role=\{state\.status === "error" \? "alert" : "status"\}/);
    expect(form).toMatch(/aria-invalid=\{Boolean\(state\.fieldErrors\?\.monthStart\)\}/);
    expect(form).toMatch(/aria-describedby="period-month-error"/);
    expect(form).toMatch(/id="period-month-error"/);
    expect(form).toMatch(/disabled=\{pending\}/);
    expect(form).not.toMatch(/name="userId"|formData\.get\(["']userId["']\)/);
  });

  it("adds mobile-first budget CSS with safe widths, 16px form text, and 44px touch targets", () => {
    const budgetPage = declarationBlock(".budget-page");
    const budgetForm = declarationBlock(".budget-period-form");
    const budgetInputs = declarationBlock(".budget-period-form input,\n.budget-period-form select");
    const budgetButton = declarationBlock(".budget-period-form button");

    expect(budgetPage).toMatch(/min-width:\s*0\s*;/);
    expect(budgetPage).toMatch(/max-width:\s*100%\s*;/);
    expect(budgetForm).toMatch(/display:\s*grid\s*;/);
    expect(budgetInputs).toMatch(/font-size:\s*16px\s*;/);
    expect(budgetInputs).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(budgetButton).toMatch(/min-height:\s*(?:44|48)px\s*;/);
  });
});
