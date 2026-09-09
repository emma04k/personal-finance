"use client";

import { useActionState } from "react";
import type {
  OwnedCategory,
  OwnedPeriod,
} from "@/modules/budget/application/owned-planning-repository";
import { createBudgetLineAction } from "./actions";
import { initialBudgetLineActionState } from "./budget-line-action-state";

export function BudgetLineForm({
  categories,
  currentPeriod,
}: {
  readonly categories: readonly OwnedCategory[];
  readonly currentPeriod: OwnedPeriod | undefined;
}) {
  const [state, action, pending] = useActionState(createBudgetLineAction, initialBudgetLineActionState);
  const hasCategories = categories.length > 0;
  const canEditPlannedLine = Boolean(currentPeriod) && hasCategories;

  return (
    <form className="budget-line-form" action={action}>
      <input type="hidden" name="periodId" value={currentPeriod?.id ?? ""} />
      <p id="budget-line-period-help" className="field-help">
        {currentPeriod
          ? `Planeando ${currentPeriod.monthStart} en ${currentPeriod.currencyCode}.`
          : "No hay un mes activo para planear todavía."}
      </p>
      <p id="budget-line-period-error" className="field-error">
        {state.fieldErrors?.periodId ?? ""}
      </p>

      {!hasCategories ? (
        <p className="field-help">Crea una categoría activa antes de agregar montos.</p>
      ) : null}

      <label htmlFor="budget-line-category">Categoría</label>
      <select
        id="budget-line-category"
        name="categoryId"
        aria-describedby="budget-line-category-error"
        aria-invalid={Boolean(state.fieldErrors?.categoryId)}
        disabled={!canEditPlannedLine || pending}
        required
      >
        {hasCategories ? null : <option value="">Crea una categoría primero</option>}
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name} · {formatCategoryTypeLabel(category.type)}
          </option>
        ))}
      </select>
      <p id="budget-line-category-error" className="field-error">
        {state.fieldErrors?.categoryId ?? ""}
      </p>

      <label htmlFor="budget-line-amount">Monto planeado</label>
      <input
        id="budget-line-amount"
        name="plannedAmount"
        type="text"
        inputMode="decimal"
        pattern="0|[1-9][0-9]*(\.[0-9]+)?"
        placeholder="Ej. 1500.50"
        aria-describedby="budget-line-amount-help budget-line-amount-error"
        aria-invalid={Boolean(state.fieldErrors?.plannedAmount)}
        disabled={!canEditPlannedLine || pending}
        required
      />
      <p id="budget-line-amount-help" className="field-help">
        Escribe el monto como lo ves en tu moneda, sin separadores de miles.
      </p>
      <p id="budget-line-amount-error" className="field-error">
        {state.fieldErrors?.plannedAmount ?? ""}
      </p>

      <label htmlFor="budget-line-currency">Moneda</label>
      <input
        id="budget-line-currency"
        name="currencyCode"
        type="text"
        value={currentPeriod?.currencyCode ?? ""}
        aria-describedby="budget-line-currency-error"
        aria-invalid={Boolean(state.fieldErrors?.currencyCode)}
        readOnly
        required
      />
      <p id="budget-line-currency-error" className="field-error">
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

      <button type="submit" disabled={pending || !canEditPlannedLine}>
        {pending ? "Guardando..." : "Guardar monto planeado"}
      </button>
    </form>
  );
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
