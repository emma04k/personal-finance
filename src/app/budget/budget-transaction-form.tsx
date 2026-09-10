"use client";

import { useActionState } from "react";
import type {
  OwnedCategory,
  OwnedPeriod,
} from "@/modules/budget/application/owned-planning-repository";
import { createBudgetTransactionAction } from "./actions";
import { initialBudgetTransactionActionState } from "./budget-transaction-action-state";

export function BudgetTransactionForm({
  categories,
  currentPeriod,
}: {
  readonly categories: readonly OwnedCategory[];
  readonly currentPeriod: OwnedPeriod | undefined;
}) {
  const [state, action, pending] = useActionState(createBudgetTransactionAction, initialBudgetTransactionActionState);
  const hasCategories = categories.length > 0;
  const canAddTransaction = Boolean(currentPeriod) && hasCategories;
  const monthStart = currentPeriod?.monthStart ?? "";
  const monthEnd = currentPeriod ? endOfMonthDate(currentPeriod.monthStart) : "";

  return (
    <form className="budget-transaction-form" action={action}>
      <input type="hidden" name="periodId" value={currentPeriod?.id ?? ""} />
      <p id="budget-transaction-period-help" className="field-help">
        {currentPeriod
          ? `Registrando movimientos de ${currentPeriod.monthStart} en ${currentPeriod.currencyCode}.`
          : "No hay un mes activo para registrar movimientos todavía."}
      </p>
      <p id="budget-transaction-period-error" className="field-error">
        {state.fieldErrors?.periodId ?? ""}
      </p>

      {!hasCategories ? (
        <p className="field-help">Crea una categoría activa antes de registrar movimientos.</p>
      ) : null}

      <label htmlFor="budget-transaction-category">Categoría</label>
      <select
        id="budget-transaction-category"
        name="categoryId"
        aria-describedby="budget-transaction-category-error"
        aria-invalid={Boolean(state.fieldErrors?.categoryId)}
        disabled={!canAddTransaction || pending}
        required
      >
        {hasCategories ? null : <option value="">Crea una categoría primero</option>}
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name} · {formatCategoryTypeLabel(category.type)}
          </option>
        ))}
      </select>
      <p id="budget-transaction-category-error" className="field-error">
        {state.fieldErrors?.categoryId ?? ""}
      </p>

      <label htmlFor="budget-transaction-amount">Monto</label>
      <input
        id="budget-transaction-amount"
        name="amount"
        type="text"
        inputMode="decimal"
        pattern="0|[1-9][0-9]*(\.[0-9]+)?"
        placeholder="Ej. 1500.50"
        aria-describedby="budget-transaction-amount-help budget-transaction-amount-error"
        aria-invalid={Boolean(state.fieldErrors?.amount)}
        disabled={!canAddTransaction || pending}
        required
      />
      <p id="budget-transaction-amount-help" className="field-help">
        Escribe el monto como lo ves en tu moneda, sin separadores de miles.
      </p>
      <p id="budget-transaction-amount-error" className="field-error">
        {state.fieldErrors?.amount ?? ""}
      </p>

      <label htmlFor="budget-transaction-occurred-on">Fecha</label>
      <input
        id="budget-transaction-occurred-on"
        name="occurredOn"
        type="date"
        defaultValue={monthStart}
        min={monthStart}
        max={monthEnd}
        aria-describedby="budget-transaction-occurred-on-error"
        aria-invalid={Boolean(state.fieldErrors?.occurredOn)}
        disabled={!canAddTransaction || pending}
        required
      />
      <p id="budget-transaction-occurred-on-error" className="field-error">
        {state.fieldErrors?.occurredOn ?? ""}
      </p>

      <label htmlFor="budget-transaction-description">Descripción</label>
      <input
        id="budget-transaction-description"
        name="description"
        type="text"
        maxLength={255}
        placeholder="Ej. Compra semanal"
        aria-describedby="budget-transaction-description-error"
        aria-invalid={Boolean(state.fieldErrors?.description)}
        disabled={!canAddTransaction || pending}
        required
      />
      <p id="budget-transaction-description-error" className="field-error">
        {state.fieldErrors?.description ?? ""}
      </p>

      <label htmlFor="budget-transaction-currency">Moneda</label>
      <input
        id="budget-transaction-currency"
        name="currencyCode"
        type="text"
        value={currentPeriod?.currencyCode ?? ""}
        aria-describedby="budget-transaction-currency-error"
        aria-invalid={Boolean(state.fieldErrors?.currencyCode)}
        readOnly
        required
      />
      <p id="budget-transaction-currency-error" className="field-error">
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

      <button type="submit" disabled={pending || !canAddTransaction}>
        {pending ? "Guardando..." : "Registrar transacción"}
      </button>
    </form>
  );
}

function endOfMonthDate(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  if (!year || !month) return monthStart;
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
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
