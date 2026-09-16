"use client";

import { useActionState } from "react";
import type { OwnedBudgetLine } from "@/modules/budget/application/owned-planning-repository";
import { deleteBudgetLineAction } from "./actions";
import { initialBudgetLineActionState } from "./budget-line-action-state";

export function BudgetLineDeleteForm({
  budgetLine,
  currentPeriodId,
}: {
  readonly budgetLine: OwnedBudgetLine;
  readonly currentPeriodId: string;
}) {
  const [state, action, pending] = useActionState(deleteBudgetLineAction, initialBudgetLineActionState);

  return (
    <form className="budget-line-delete-form" action={action}>
      <input type="hidden" name="periodId" value={currentPeriodId} />
      <input type="hidden" name="budgetLineId" value={budgetLine.id} />
      <button
        type="submit"
        aria-label={`Eliminar monto planeado ${budgetLine.categoryName}`}
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