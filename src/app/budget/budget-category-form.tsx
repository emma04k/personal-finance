"use client";

import { useActionState } from "react";
import { createBudgetCategoryAction } from "./actions";
import { initialBudgetCategoryActionState } from "./budget-category-action-state";

export function BudgetCategoryForm() {
  const [state, action, pending] = useActionState(createBudgetCategoryAction, initialBudgetCategoryActionState);

  return (
    <form className="budget-category-form" action={action}>
      <label htmlFor="category-type">Tipo</label>
      <select
        id="category-type"
        name="type"
        defaultValue="EXPENSE"
        aria-describedby="category-type-error"
        aria-invalid={Boolean(state.fieldErrors?.type)}
        required
      >
        <option value="INCOME">Ingreso</option>
        <option value="EXPENSE">Gasto</option>
        <option value="SAVINGS">Ahorro</option>
        <option value="DEBT_PAYMENT">Pago de deuda</option>
      </select>
      <p id="category-type-error" className="field-error">
        {state.fieldErrors?.type ?? ""}
      </p>

      <label htmlFor="category-name">Nombre</label>
      <input
        id="category-name"
        name="name"
        type="text"
        maxLength={120}
        placeholder="Ej. Mercado"
        aria-describedby="category-name-error"
        aria-invalid={Boolean(state.fieldErrors?.name)}
        required
      />
      <p id="category-name-error" className="field-error">
        {state.fieldErrors?.name ?? ""}
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

      <button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Crear categoría"}
      </button>
    </form>
  );
}
