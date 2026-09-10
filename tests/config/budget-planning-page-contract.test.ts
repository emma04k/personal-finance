import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = resolve("src/app/budget/page.tsx");
const actionPath = resolve("src/app/budget/actions.ts");
const budgetLineActionStatePath = resolve("src/app/budget/budget-line-action-state.ts");
const budgetLineFormPath = resolve("src/app/budget/budget-line-form.tsx");
const transactionActionStatePath = resolve("src/app/budget/budget-transaction-action-state.ts");
const transactionFormPath = resolve("src/app/budget/budget-transaction-form.tsx");
const categoryActionStatePath = resolve("src/app/budget/budget-category-action-state.ts");
const categoryFormPath = resolve("src/app/budget/budget-category-form.tsx");
const actionStatePath = resolve("src/app/budget/budget-period-action-state.ts");
const formPath = resolve("src/app/budget/budget-period-form.tsx");
const stylesheetPath = resolve("src/app/globals.css");

function source(path: string) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

const sharedBudgetFormSelector = ".budget-period-form,\n.budget-category-form,\n.budget-line-form,\n.budget-transaction-form";
const sharedBudgetInputSelector = ".budget-period-form input,\n.budget-period-form select,\n.budget-category-form input,\n.budget-category-form select,\n.budget-line-form input,\n.budget-line-form select,\n.budget-transaction-form input,\n.budget-transaction-form select";
const sharedBudgetButtonSelector = ".budget-period-form button,\n.budget-category-form button,\n.budget-line-form button,\n.budget-transaction-form button";
const sharedBudgetListSelector = ".category-list,\n.planned-line-list,\n.transaction-list";
const sharedBudgetListItemSelector = ".category-list-item,\n.planned-line-list-item,\n.transaction-list-item";
const sharedBudgetListTextSelector = ".category-list-item span,\n.category-list-item small,\n.planned-line-list-item span,\n.planned-line-list-item strong,\n.planned-line-list-item small,\n.transaction-list-item span,\n.transaction-list-item strong,\n.transaction-list-item small";

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
    const budgetForm = declarationBlock(sharedBudgetFormSelector);
    const budgetInputs = declarationBlock(sharedBudgetInputSelector);
    const budgetButton = declarationBlock(sharedBudgetButtonSelector);

    expect(budgetPage).toMatch(/min-width:\s*0\s*;/);
    expect(budgetPage).toMatch(/max-width:\s*100%\s*;/);
    expect(budgetForm).toMatch(/display:\s*grid\s*;/);
    expect(budgetInputs).toMatch(/font-size:\s*16px\s*;/);
    expect(budgetInputs).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(budgetButton).toMatch(/min-height:\s*(?:44|48)px\s*;/);
  });

  it("adds mobile-first category form and list CSS", () => {
    const categoryForm = declarationBlock(sharedBudgetFormSelector);
    const categoryInputs = declarationBlock(sharedBudgetInputSelector);
    const categoryButton = declarationBlock(sharedBudgetButtonSelector);
    const categoryList = declarationBlock(sharedBudgetListSelector);
    const categoryItem = declarationBlock(sharedBudgetListItemSelector);
    const categoryItemText = declarationBlock(sharedBudgetListTextSelector);

    expect(categoryForm).toMatch(/display:\s*grid\s*;/);
    expect(categoryInputs).toMatch(/font-size:\s*16px\s*;/);
    expect(categoryInputs).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(categoryButton).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(categoryList).toMatch(/display:\s*grid\s*;/);
    expect(categoryList).toMatch(/gap:\s*\d+px\s*;/);
    expect(categoryItem).toMatch(/min-width:\s*0\s*;/);
    expect(categoryItemText).toMatch(/overflow-wrap:\s*anywhere\s*;/);
  });

  it("applies the same accessible feedback CSS to budget forms", () => {
    const stylesheet = source(stylesheetPath);

    expect(stylesheet).toMatch(/\.budget-period-form \.field-error,\n\.budget-category-form \.field-error,\n\.budget-line-form \.field-error,\n\.budget-transaction-form \.field-error/);
    expect(stylesheet).toMatch(/\.budget-period-form \[aria-invalid="true"\],\n\.budget-category-form \[aria-invalid="true"\],\n\.budget-line-form \[aria-invalid="true"\],\n\.budget-transaction-form \[aria-invalid="true"\]/);
    expect(stylesheet).toMatch(/\.budget-period-form \.form-feedback,\n\.budget-category-form \.form-feedback,\n\.budget-line-form \.form-feedback,\n\.budget-transaction-form \.form-feedback/);
    expect(stylesheet).toMatch(/\.budget-period-form \.form-feedback-error,\n\.budget-category-form \.form-feedback-error,\n\.budget-line-form \.form-feedback-error,\n\.budget-transaction-form \.form-feedback-error/);
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

  it("adds clear disabled states for unavailable transaction prerequisites", () => {
    const stylesheet = source(stylesheetPath);
    const form = source(transactionFormPath);

    expect(stylesheet).toMatch(/input:disabled/);
    expect(form).toMatch(/const canAddTransaction = Boolean\(currentPeriod\) && hasCategories/);
    expect(form).toMatch(/No hay un mes activo para registrar movimientos todavía\./);
    expect(form).toMatch(/Crea una categoría activa antes de registrar movimientos\./);
    expect(form).toMatch(/disabled=\{!canAddTransaction \|\| pending\}/);
  });

  it("keeps shared budget form CSS consolidated across transaction and planning forms", () => {
    const stylesheet = source(stylesheetPath);

    expect(stylesheet).toMatch(/\.budget-period-form,\n\.budget-category-form,\n\.budget-line-form,\n\.budget-transaction-form\s*\{/);
    expect(stylesheet).not.toMatch(/\.budget-period-form,\n\.budget-category-form,\n\.budget-line-form\s*\{/);
    expect(stylesheet).not.toMatch(/\.budget-period-form input,\n\.budget-period-form select,\n\.budget-category-form input,\n\.budget-category-form select,\n\.budget-line-form input,\n\.budget-line-form select\s*\{/);
    expect(stylesheet).not.toMatch(/\.budget-period-form button,\n\.budget-category-form button,\n\.budget-line-form button\s*\{/);
  });

  it("adds accessible CSS for the planned budget line form and list", () => {
    const budgetLineForm = declarationBlock(sharedBudgetFormSelector);
    const budgetLineInputs = declarationBlock(sharedBudgetInputSelector);
    const budgetLineButton = declarationBlock(sharedBudgetButtonSelector);
    const plannedLineList = declarationBlock(sharedBudgetListSelector);
    const plannedLineItem = declarationBlock(sharedBudgetListItemSelector);
    const plannedLineItemText = declarationBlock(sharedBudgetListTextSelector);

    expect(budgetLineForm).toMatch(/display:\s*grid\s*;/);
    expect(budgetLineInputs).toMatch(/font-size:\s*16px\s*;/);
    expect(budgetLineInputs).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(budgetLineButton).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(plannedLineList).toMatch(/display:\s*grid\s*;/);
    expect(plannedLineList).toMatch(/gap:\s*\d+px\s*;/);
    expect(plannedLineItem).toMatch(/min-width:\s*0\s*;/);
    expect(plannedLineItemText).toMatch(/overflow-wrap:\s*anywhere\s*;/);
  });

  it("renders current-period transactions and summary data without client owner fields", () => {
    expect(existsSync(transactionActionStatePath)).toBe(true);
    expect(existsSync(transactionFormPath)).toBe(true);
    const page = source(pagePath);
    const form = source(transactionFormPath);
    const action = source(actionPath);
    const actionState = source(transactionActionStatePath);

    expect(actionState).toMatch(/export type BudgetTransactionActionState/);
    expect(actionState).toMatch(/export const initialBudgetTransactionActionState/);
    expect(page).toMatch(/listTransactionsForOwnerPeriod\(owner\.userId, currentPeriod\.id\)/);
    expect(page).toMatch(/BudgetTransactionForm/);
    expect(page).toMatch(/transactions\.map/);
    expect(page).toMatch(/currentPeriod=\{state\.currentPeriod\}/);
    expect(page).toMatch(/formatTransactionAmount\(transaction\.amountMinor, transaction\.currencyCode, transaction\.direction\)/);
    expect(page).toMatch(/aria-labelledby="transactions-heading"/);
    expect(page).toMatch(/buildMonthlyBudgetSummary/);
    expect(page).toMatch(/aria-labelledby="monthly-summary-heading"/);
    expect(page).toMatch(/summary\.availableBalance/);
    expect(page).toMatch(/summary\.income/);
    expect(page).toMatch(/summary\.consumptionExpenses/);
    expect(page).toMatch(/summary\.debtPayments/);
    expect(page).toMatch(/summary\.savingsAllocations/);
    expect(page).toMatch(/summary\.incomeVariance/);
    expect(page).toMatch(/summary\.expenseVariance/);
    expect(page).toMatch(/summary\.totalOutflowRate/);
    expect(page).toMatch(/formatCompletenessLabel/);
    expect(page).toMatch(/plannedValuesUsed/);
    expect(form).toMatch(/useActionState\(createBudgetTransactionAction, initialBudgetTransactionActionState\)/);
    expect(form).toMatch(/<input type="hidden" name="periodId" value=\{currentPeriod\?\.id \?\? ""\} \/>/);
    expect(form).toMatch(/htmlFor="budget-transaction-category"/);
    expect(form).toMatch(/name="categoryId"/);
    expect(form).toMatch(/htmlFor="budget-transaction-amount"/);
    expect(form).toMatch(/name="amount"/);
    expect(form).toMatch(/inputMode="decimal"/);
    expect(form).toMatch(/htmlFor="budget-transaction-occurred-on"/);
    expect(form).toMatch(/name="occurredOn"/);
    expect(form).toMatch(/type="date"/);
    expect(form).toMatch(/htmlFor="budget-transaction-description"/);
    expect(form).toMatch(/name="description"/);
    expect(form).toMatch(/name="currencyCode"/);
    expect(form).toMatch(/readOnly/);
    expect(form).toMatch(/aria-live="polite"/);
    expect(action).toMatch(/createBudgetTransactionAction/);
    expect(action).toMatch(/createPeriodTransaction/);
    expect(action).toMatch(/stringField\(formData, "amount"\)/);
    expect(action).not.toMatch(/stringField\(formData, "amountMinor"\)/);
    expect(`${page}\n${form}\n${action}`).not.toMatch(/name="userId"|formData\.get\(["']userId["']\)|userId:\s*formData/);
    expect(form).not.toMatch(/>[^<]*(upsert|minor units|Prisma|repository|ownerUserId|dueño autenticado|tu sesión)[^<]*</i);
    expect(action).not.toMatch(/unidades menores|minor units/i);
  });

  it("binds the transaction form and list to the same current period", () => {
    const page = source(pagePath);
    const form = source(transactionFormPath);

    expect(page).toMatch(/transactions = currentPeriod[\s\S]*listTransactionsForOwnerPeriod\(owner\.userId, currentPeriod\.id\)/);
    expect(page).toMatch(/<BudgetTransactionForm[\s\S]*currentPeriod=\{state\.currentPeriod\}/);
    expect(form).toMatch(/<input type="hidden" name="periodId" value=\{currentPeriod\?\.id \?\? ""\} \/>/);
    expect(form).not.toMatch(/periods\.map|<option key=\{period\.id\}/);
  });

  it("adds mobile accessible CSS for transactions", () => {
    const transactionForm = declarationBlock(sharedBudgetFormSelector);
    const transactionInputs = declarationBlock(sharedBudgetInputSelector);
    const transactionButton = declarationBlock(sharedBudgetButtonSelector);
    const transactionList = declarationBlock(sharedBudgetListSelector);
    const transactionItem = declarationBlock(sharedBudgetListItemSelector);
    const transactionText = declarationBlock(sharedBudgetListTextSelector);

    expect(transactionForm).toMatch(/display:\s*grid\s*;/);
    expect(transactionInputs).toMatch(/font-size:\s*16px\s*;/);
    expect(transactionInputs).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(transactionButton).toMatch(/min-height:\s*(?:44|48)px\s*;/);
    expect(transactionList).toMatch(/display:\s*grid\s*;/);
    expect(transactionList).toMatch(/gap:\s*\d+px\s*;/);
    expect(transactionItem).toMatch(/min-width:\s*0\s*;/);
    expect(transactionText).toMatch(/overflow-wrap:\s*anywhere\s*;/);
  });
});
