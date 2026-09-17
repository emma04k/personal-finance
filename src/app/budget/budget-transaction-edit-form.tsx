"use client";

import { useActionState } from "react";
import type {
  OwnedCategory,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import { updateBudgetTransactionAction } from "./actions";
import { initialBudgetTransactionActionState } from "./budget-transaction-action-state";

export function BudgetTransactionEditForm({
  categories,
  currentPeriodId,
  transaction,
}: {
  readonly categories: readonly OwnedCategory[];
  readonly currentPeriodId: string;
  readonly transaction: OwnedTransaction;
}) {
  const [state, action, pending] = useActionState(updateBudgetTransactionAction, initialBudgetTransactionActionState);

  return (
    <form className="budget-transaction-edit-form" action={action}>
      <input type="hidden" name="periodId" value={currentPeriodId} />
      <input type="hidden" name="transactionId" value={transaction.id} />

      <label htmlFor={`budget-transaction-edit-category-${transaction.id}`}>Editar categoría</label>
      <select
        id={`budget-transaction-edit-category-${transaction.id}`}
        name="categoryId"
        defaultValue={transaction.categoryId}
        aria-describedby={`budget-transaction-edit-category-error-${transaction.id}`}
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
      <p id={`budget-transaction-edit-category-error-${transaction.id}`} className="field-error">
        {state.fieldErrors?.categoryId ?? ""}
      </p>

      <label htmlFor={`budget-transaction-edit-amount-${transaction.id}`}>Editar monto</label>
      <input
        id={`budget-transaction-edit-amount-${transaction.id}`}
        name="amount"
        type="text"
        inputMode="decimal"
        pattern="0|[1-9][0-9]*(\.[0-9]+)?"
        defaultValue={formatEditableAmount(transaction.amountMinor, transaction.currencyCode)}
        aria-describedby={`budget-transaction-edit-amount-error-${transaction.id}`}
        aria-invalid={Boolean(state.fieldErrors?.amount)}
        disabled={pending}
        required
      />
      <p id={`budget-transaction-edit-amount-error-${transaction.id}`} className="field-error">
        {state.fieldErrors?.amount ?? ""}
      </p>

      <label htmlFor={`budget-transaction-edit-occurred-on-${transaction.id}`}>Editar fecha</label>
      <input
        id={`budget-transaction-edit-occurred-on-${transaction.id}`}
        name="occurredOn"
        type="date"
        defaultValue={transaction.occurredOn}
        aria-describedby={`budget-transaction-edit-occurred-on-error-${transaction.id}`}
        aria-invalid={Boolean(state.fieldErrors?.occurredOn)}
        disabled={pending}
        required
      />
      <p id={`budget-transaction-edit-occurred-on-error-${transaction.id}`} className="field-error">
        {state.fieldErrors?.occurredOn ?? ""}
      </p>

      <label htmlFor={`budget-transaction-edit-description-${transaction.id}`}>Editar descripción</label>
      <input
        id={`budget-transaction-edit-description-${transaction.id}`}
        name="description"
        type="text"
        maxLength={255}
        defaultValue={transaction.description}
        aria-describedby={`budget-transaction-edit-description-error-${transaction.id}`}
        aria-invalid={Boolean(state.fieldErrors?.description)}
        disabled={pending}
        required
      />
      <p id={`budget-transaction-edit-description-error-${transaction.id}`} className="field-error">
        {state.fieldErrors?.description ?? ""}
      </p>

      <label htmlFor={`budget-transaction-edit-currency-${transaction.id}`}>Editar moneda</label>
      <input
        id={`budget-transaction-edit-currency-${transaction.id}`}
        name="currencyCode"
        type="text"
        value={transaction.currencyCode}
        aria-describedby={`budget-transaction-edit-currency-error-${transaction.id}`}
        aria-invalid={Boolean(state.fieldErrors?.currencyCode)}
        readOnly
        required
      />
      <p id={`budget-transaction-edit-currency-error-${transaction.id}`} className="field-error">
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

      <button type="submit" disabled={pending} aria-label={`Editar transacción ${transaction.description}`}>
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
