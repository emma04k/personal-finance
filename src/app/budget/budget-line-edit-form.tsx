"use client";

import { useActionState } from "react";
import type {
  OwnedBudgetLine,
  OwnedCategory,
} from "@/modules/budget/application/owned-planning-repository";
import { updateBudgetLineAction } from "./actions";
import { initialBudgetLineActionState } from "./budget-line-action-state";

export function BudgetLineEditForm({
  budgetLine,
  categories,
  currentPeriodId,
}: {
  readonly budgetLine: OwnedBudgetLine;
  readonly categories: readonly OwnedCategory[];
  readonly currentPeriodId: string;
}) {
  const [state, action, pending] = useActionState(updateBudgetLineAction, initialBudgetLineActionState);

  return (
    <form className="budget-line-edit-form" action={action}>
      <input type="hidden" name="periodId" value={currentPeriodId} />
      <input type="hidden" name="budgetLineId" value={budgetLine.id} />

      <label htmlFor={`budget-line-edit-category-${budgetLine.id}`}>Editar categoría</label>
      <select
        id={`budget-line-edit-category-${budgetLine.id}`}
        name="categoryId"
        defaultValue={budgetLine.categoryId}
        aria-describedby={`budget-line-edit-category-error-${budgetLine.id}`}
        aria-invalid={Boolean(state.fieldErrors?.categoryId)}
        disabled={pending}
        required
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name} · {formatCategoryTypeLabel(category.type)}
          </option>
        ))}
      </select>
      <p id={`budget-line-edit-category-error-${budgetLine.id}`} className="field-error">
        {state.fieldErrors?.categoryId ?? ""}
      </p>

      <label htmlFor={`budget-line-edit-amount-${budgetLine.id}`}>Editar monto planeado</label>
      <input
        id={`budget-line-edit-amount-${budgetLine.id}`}
        name="plannedAmount"
        type="text"
        inputMode="decimal"
        pattern="0|[1-9][0-9]*(\.[0-9]+)?"
        defaultValue={formatEditableAmount(budgetLine.plannedAmountMinor, budgetLine.currencyCode)}
        aria-describedby={`budget-line-edit-amount-error-${budgetLine.id}`}
        aria-invalid={Boolean(state.fieldErrors?.plannedAmount)}
        disabled={pending}
        required
      />
      <p id={`budget-line-edit-amount-error-${budgetLine.id}`} className="field-error">
        {state.fieldErrors?.plannedAmount ?? ""}
      </p>

      <label htmlFor={`budget-line-edit-currency-${budgetLine.id}`}>Editar moneda</label>
      <input
        id={`budget-line-edit-currency-${budgetLine.id}`}
        name="currencyCode"
        type="text"
        value={budgetLine.currencyCode}
        aria-describedby={`budget-line-edit-currency-error-${budgetLine.id}`}
        aria-invalid={Boolean(state.fieldErrors?.currencyCode)}
        readOnly
        required
      />
      <p id={`budget-line-edit-currency-error-${budgetLine.id}`} className="field-error">
        {state.fieldErrors?.currencyCode ?? ""}
      </p>

      {state.message ? (
        <p
          className={`form-feedback form-feedback-${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={pending} aria-label={`Editar monto planeado ${budgetLine.categoryName}`}>
        {pending ? "Actualizando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

function formatEditableAmount(minorUnits: string, currencyCode: string) {
  const exponent = currencyCode === "JPY" ? 0 : currencyCode === "KWD" ? 3 : 2;
  if (exponent === 0) return minorUnits;
  const padded = minorUnits.padStart(exponent + 1, "0");
  const whole = padded.slice(0, -exponent);
  const fraction = padded.slice(-exponent);
  return `${whole}.${fraction}`;
}

function formatCategoryTypeLabel(type: OwnedCategory["type"]) {
  switch (type) {
    case "INCOME":
      return "Ingreso";
    case "EXPENSE":
      return "Gasto";
    case "SAVINGS":
      return "Ahorro";
    case "DEBT_PAYMENT":
      return "Pago de deuda";
  }
}
