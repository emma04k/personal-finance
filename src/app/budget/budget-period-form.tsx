"use client";

import { useActionState } from "react";
import { createBudgetPeriodAction } from "./actions";
import { initialBudgetPeriodActionState } from "./budget-period-action-state";

export function BudgetPeriodForm({
  currentMonthStart,
}: {
  readonly currentMonthStart: string;
}) {
  const [state, action, pending] = useActionState(createBudgetPeriodAction, initialBudgetPeriodActionState);

  return (
    <form className="budget-period-form" action={action}>
      <label htmlFor="period-month">Inicio del mes</label>
      <input
        id="period-month"
        name="monthStart"
        type="month"
        defaultValue={currentMonthStart}
        aria-describedby="period-month-error"
        aria-invalid={Boolean(state.fieldErrors?.monthStart)}
        required
      />
      <p id="period-month-error" className="field-error">
        {state.fieldErrors?.monthStart ?? ""}
      </p>

      <label htmlFor="period-currency">Moneda</label>
      <select
        id="period-currency"
        name="currencyCode"
        defaultValue="COP"
        aria-describedby="period-currency-error"
        aria-invalid={Boolean(state.fieldErrors?.currencyCode)}
        required
      >
        <option value="COP">COP</option>
        <option value="USD">USD</option>
        <option value="JPY">JPY</option>
        <option value="KWD">KWD</option>
      </select>
      <p id="period-currency-error" className="field-error">
        {state.fieldErrors?.currencyCode ?? ""}
      </p>

      <label htmlFor="period-time-zone">Zona horaria</label>
      <input
        id="period-time-zone"
        name="timeZone"
        type="text"
        defaultValue="America/Bogota"
        autoComplete="off"
        aria-describedby="period-time-zone-error"
        aria-invalid={Boolean(state.fieldErrors?.timeZone)}
        required
      />
      <p id="period-time-zone-error" className="field-error">
        {state.fieldErrors?.timeZone ?? ""}
      </p>

      <label htmlFor="period-note">Nota opcional</label>
      <input
        id="period-note"
        name="note"
        type="text"
        maxLength={500}
        placeholder="Ej. Mes con pagos especiales"
        aria-describedby="period-note-error"
        aria-invalid={Boolean(state.fieldErrors?.note)}
      />
      <p id="period-note-error" className="field-error">
        {state.fieldErrors?.note ?? ""}
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
        {pending ? "Guardando..." : "Crear o abrir periodo"}
      </button>
    </form>
  );
}
