"use client";

import { useActionState } from "react";
import type { OwnedDebtAccount } from "@/modules/debt/application/owned-debt-account-repository";
import { archiveDebtAccountAction } from "./actions";
import { initialDebtAccountActionState } from "./debt-account-action-state";

export type DebtAccountArchiveFormAccount = Pick<OwnedDebtAccount, "id" | "name">;

export function DebtAccountArchiveForm({ account }: { readonly account: DebtAccountArchiveFormAccount }) {
  const [state, action, pending] = useActionState(
    archiveDebtAccountAction,
    initialDebtAccountActionState,
  );

  return (
    <form className="debt-account-archive-form" action={action} aria-label={`Archive ${account.name}`}>
      <input type="hidden" name="debtAccountId" value={account.id} />

      {state.fieldErrors?.debtAccountId ? (
        <p className="field-error" role="alert">
          {state.fieldErrors.debtAccountId}
        </p>
      ) : null}

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
        {pending ? "Archiving debt account..." : "Archive debt account"}
      </button>
    </form>
  );
}
