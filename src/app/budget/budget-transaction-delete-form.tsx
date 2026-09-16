"use client";

import { useActionState } from "react";
import type { OwnedTransaction } from "@/modules/budget/application/owned-planning-repository";
import { deleteBudgetTransactionAction } from "./actions";
import { initialBudgetTransactionActionState } from "./budget-transaction-action-state";

export function BudgetTransactionDeleteForm({
  currentPeriodId,
  transaction,
}: {
  readonly currentPeriodId: string;
  readonly transaction: OwnedTransaction;
}) {
  const [state, action, pending] = useActionState(deleteBudgetTransactionAction, initialBudgetTransactionActionState);

  return (
    <form className="budget-transaction-delete-form" action={action}>
      <input type="hidden" name="periodId" value={currentPeriodId} />
      <input type="hidden" name="transactionId" value={transaction.id} />
      <button
        type="submit"
        aria-label={`Eliminar transacción ${transaction.description}`}
        disabled={pending}
      >
        {pending ? "Eliminando..." : "Eliminar"}
      </button>
      {state.message ? (
        <p
          className={`form-feedback form-feedback-${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
