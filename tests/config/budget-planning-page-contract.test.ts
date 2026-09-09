import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve("src/app/budget/page.tsx");
const actionPath = resolve("src/app/budget/actions.ts");
const budgetLineActionStatePath = resolve("src/app/budget/budget-line-action-state.ts");
const budgetLineFormPath = resolve("src/app/budget/budget-line-form.tsx");
const categoryActionStatePath = resolve("src/app/budget/budget-category-action-state.ts");
const categoryFormPath = resolve("src/app/budget/budget-category-form.tsx");
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

  it("derives the default month from the same project-owned timezone shown in the form", () => {
    const page = source(pagePath);
    const form = source(formPath);

    expect(page).toMatch(/DEFAULT_BUDGET_TIME_ZONE/);
    expect(page).toMatch(/buildCurrentMonthStartForTimeZone\(\{[\s\S]*now:\s*new Date\(\),[\s\S]*timeZone:\s*DEFAULT_BUDGET_TIME_ZONE,?[\s\S]*\}\)/);
    expect(page).toMatch(/<BudgetPeriodForm currentMonthStart=\{currentMonthStart\} defaultTimeZone=\{DEFAULT_BUDGET_TIME_ZONE\}/);
    expect(page).not.toMatch(/getUTCFullYear|getUTCMonth/);
    expect(form).toMatch(/defaultTimeZone/);
    expect(form).toMatch(/defaultValue=\{defaultTimeZone\}/);
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

  it("renders active owner-scoped categories and a category creation form", () => {
    const page = source(pagePath);

    expect(page).toMatch(/listActiveCategoriesForOwner\(owner\.userId\)/);
    expect(page).toMatch(/BudgetCategoryForm/);
    expect(page).toMatch(/categories\.map/);
    expect(page).toMatch(/category\.archivedAt/);
    expect(page).toMatch(/aria-labelledby="create-category-heading"/);
    expect(page).toMatch(/aria-labelledby="active-categories-heading"/);
  });

  it("keeps category server-action state typed outside the use server module", () => {
    expect(existsSync(categoryActionStatePath)).toBe(true);
    const action = source(actionPath);
    const actionState = source(categoryActionStatePath);

    expect(actionState).toMatch(/export type BudgetCategoryActionState/);
    expect(actionState).toMatch(/export const initialBudgetCategoryActionState/);
    expect(action).toMatch(/import type \{[\s\S]*BudgetCategoryActionState/);
    expect(action).toMatch(/createBudgetCategoryAction/);
    expect(action).toMatch(/createBudgetCategory/);
    expect(action).not.toMatch(/formData\.get\(["']userId["']\)|userId:\s*formData/);
  });

  it("renders accessible inline category-form feedback through useActionState", () => {
    expect(existsSync(categoryFormPath)).toBe(true);
    const form = source(categoryFormPath);

    expect(form).toMatch(/["']use client["']/);
    expect(form).toMatch(/useActionState\(createBudgetCategoryAction, initialBudgetCategoryActionState\)/);
    expect(form).toMatch(/<form className="budget-category-form" action=\{action\}/);
    expect(form).toMatch(/htmlFor="category-type"/);
    expect(form).toMatch(/name="type"/);
    expect(form).toMatch(/htmlFor="category-name"/);
    expect(form).toMatch(/name="name"/);
    expect(form).toMatch(/aria-live="polite"/);
    expect(form).toMatch(/role=\{state\.status === "error" \? "alert" : "status"\}/);
    expect(form).toMatch(/aria-invalid=\{Boolean\(state\.fieldErrors\?\.name\)\}/);
    expect(form).toMatch(/aria-describedby="category-name-error"/);
    expect(form).toMatch(/disabled=\{pending\}/);
    expect(form).not.toMatch(/name="userId"|formData\.get\(["']userId["']\)/);
  });

  it("adds mobile-first budget CSS with safe widths, 16px form text, and 44px touch targets", () => {
    const budgetPage = declarationBlock(".budget-page");
    const budgetForm = declarationBlock(".budget-period-form,\n.budget-category-form,\n.budget-line-form");
    const budgetInputs = declarationBlock(".budget-period-form input,\n.budget-period-form select,\n.budget-category-form input,\n.budget-category-form select,\n.budget-line-form input,\n.budget-line-form select");
    const budgetButton = declarationBlock(".budget-period-form button,\n.budget-category-form button,\n.budget-line-form button");

    expect(budgetPage).toMatch(/min-width:\s*0\s*;/);
    expect(budgetPage).toMatch(/max-width:\s*100%\s*;/);
    expect(budgetForm).toMatch(/display:\s*grid\s*;/);
    expect(budgetInputs).toMatch(/font-size:\s*16px\s*;/);
    expect(budgetInputs).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(budgetButton).toMatch(/min-height:\s*(?:44|48)px\s*;/);
  });

  it("adds mobile-first category form and list CSS", () => {
    const categoryForm = declarationBlock(".budget-period-form,\n.budget-category-form,\n.budget-line-form");
    const categoryInputs = declarationBlock(".budget-period-form input,\n.budget-period-form select,\n.budget-category-form input,\n.budget-category-form select,\n.budget-line-form input,\n.budget-line-form select");
    const categoryButton = declarationBlock(".budget-period-form button,\n.budget-category-form button,\n.budget-line-form button");
    const categoryList = declarationBlock(".category-list");
    const categoryItem = declarationBlock(".category-list-item");
    const categoryItemText = declarationBlock(".category-list-item span,\n.category-list-item small");

    expect(categoryForm).toMatch(/display:\s*grid\s*;/);
    expect(categoryInputs).toMatch(/font-size:\s*16px\s*;/);
    expect(categoryInputs).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(categoryButton).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(categoryList).toMatch(/display:\s*grid\s*;/);
    expect(categoryList).toMatch(/gap:\s*\d+px\s*;/);
    expect(categoryItem).toMatch(/min-width:\s*0\s*;/);
    expect(categoryItemText).toMatch(/overflow-wrap:\s*anywhere\s*;/);
  });

  it("applies the same accessible feedback CSS to category and period forms", () => {
    const stylesheet = source(stylesheetPath);

    expect(stylesheet).toMatch(/\.budget-period-form \.field-error,\n\.budget-category-form \.field-error,\n\.budget-line-form \.field-error/);
    expect(stylesheet).toMatch(/\.budget-period-form \[aria-invalid="true"\],\n\.budget-category-form \[aria-invalid="true"\],\n\.budget-line-form \[aria-invalid="true"\]/);
    expect(stylesheet).toMatch(/\.budget-period-form \.form-feedback,\n\.budget-category-form \.form-feedback,\n\.budget-line-form \.form-feedback/);
    expect(stylesheet).toMatch(/\.budget-period-form \.form-feedback-error,\n\.budget-category-form \.form-feedback-error,\n\.budget-line-form \.form-feedback-error/);
  });

  it("renders user-facing planned amount entry and current period planned lines without client owner fields", () => {
    expect(existsSync(budgetLineActionStatePath)).toBe(true);
    expect(existsSync(budgetLineFormPath)).toBe(true);
    const page = source(pagePath);
    const form = source(budgetLineFormPath);
    const action = source(actionPath);

    expect(page).toMatch(/listPlannedBudgetLinesForOwnerPeriod\(owner\.userId/);
    expect(page).toMatch(/BudgetLineForm/);
    expect(page).toMatch(/plannedBudgetLines\.map/);
    expect(page).toMatch(/currentPeriod=\{state\.currentPeriod\}/);
    expect(page).toMatch(/currentPeriod\?\.id/);
    expect(page).toMatch(/formatBudgetLineAmount\(budgetLine\.plannedAmountMinor, budgetLine\.currencyCode\)/);
    expect(page).toMatch(/aria-labelledby="planned-lines-heading"/);
    expect(form).toMatch(/useActionState\(createBudgetLineAction, initialBudgetLineActionState\)/);
    expect(form).toMatch(/name="periodId"/);
    expect(form).toMatch(/type="hidden"/);
    expect(form).not.toMatch(/<select[\s\S]*name="periodId"/);
    expect(form).toMatch(/htmlFor="budget-line-category"/);
    expect(form).toMatch(/name="categoryId"/);
    expect(form).toMatch(/htmlFor="budget-line-amount"/);
    expect(form).toMatch(/name="plannedAmount"/);
    expect(form).toMatch(/inputMode="decimal"/);
    expect(form).not.toMatch(/name="plannedAmountMinor"|minor units|unidades menores/i);
    expect(form).toMatch(/placeholder="Ej. 1500\.50"/);
    expect(form).toMatch(/disabled=\{!canEditPlannedLine \|\| pending\}/);
    expect(form).toMatch(/name="currencyCode"/);
    expect(form).toMatch(/readOnly/);
    expect(form).toMatch(/aria-live="polite"/);
    expect(action).toMatch(/createBudgetLineAction/);
    expect(action).toMatch(/stringField\(formData, "plannedAmount"\)/);
    expect(action).not.toMatch(/stringField\(formData, "plannedAmountMinor"\)/);
    expect(`${page}\n${form}\n${action}`).not.toMatch(/name="userId"|formData\.get\(["']userId["']\)|userId:\s*formData/);
    expect(form).not.toMatch(/>[^<]*(upsert|minor units|Prisma|repository|dueño autenticado|tu sesión)[^<]*</i);
    expect(action).not.toMatch(/unidades menores|minor units/i);
  });

  it("binds the planned-line form to the same current period rendered in the visible list", () => {
    const page = source(pagePath);
    const form = source(budgetLineFormPath);

    expect(page).toMatch(/currentPeriod:\s*OwnedPeriod \| undefined/);
    expect(page).toMatch(/plannedBudgetLines = currentPeriod[\s\S]*listPlannedBudgetLinesForOwnerPeriod\(owner\.userId, currentPeriod\.id\)/);
    expect(page).toMatch(/<BudgetLineForm[\s\S]*currentPeriod=\{state\.currentPeriod\}/);
    expect(form).toMatch(/<input type="hidden" name="periodId" value=\{currentPeriod\?\.id \?\? ""\} \/>/);
    expect(form).not.toMatch(/periods\.map|<option key=\{period\.id\}/);
  });

  it("adds clear disabled states for unavailable planned-line prerequisites", () => {
    const stylesheet = source(stylesheetPath);
    const form = source(budgetLineFormPath);

    expect(stylesheet).toMatch(/input:disabled/);
    expect(form).toMatch(/const canEditPlannedLine = Boolean\(currentPeriod\) && hasCategories/);
    expect(form).toMatch(/No hay un mes activo para planear todavía\./);
    expect(form).toMatch(/Crea una categoría activa antes de agregar montos\./);
  });

  it("adds accessible CSS for the planned budget line form and list", () => {
    const budgetLineForm = declarationBlock(".budget-period-form,\n.budget-category-form,\n.budget-line-form");
    const budgetLineInputs = declarationBlock(".budget-period-form input,\n.budget-period-form select,\n.budget-category-form input,\n.budget-category-form select,\n.budget-line-form input,\n.budget-line-form select");
    const budgetLineButton = declarationBlock(".budget-period-form button,\n.budget-category-form button,\n.budget-line-form button");
    const plannedLineList = declarationBlock(".planned-line-list");
    const plannedLineItem = declarationBlock(".planned-line-list-item");
    const plannedLineItemText = declarationBlock(".planned-line-list-item span,\n.planned-line-list-item strong,\n.planned-line-list-item small");

    expect(budgetLineForm).toMatch(/display:\s*grid\s*;/);
    expect(budgetLineInputs).toMatch(/font-size:\s*16px\s*;/);
    expect(budgetLineInputs).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(budgetLineButton).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(plannedLineList).toMatch(/display:\s*grid\s*;/);
    expect(plannedLineList).toMatch(/gap:\s*\d+px\s*;/);
    expect(plannedLineItem).toMatch(/min-width:\s*0\s*;/);
    expect(plannedLineItemText).toMatch(/overflow-wrap:\s*anywhere\s*;/);
  });
});
