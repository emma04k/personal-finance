"use client";

import { useActionState } from "react";
import type { OwnedDebtAccount } from "@/modules/debt/application/owned-debt-account-repository";
import { formatEditableCurrencyMinorUnits } from "@/modules/finance/application/currency-amount";
import { updateDebtAccountAction } from "./actions";
import { initialDebtAccountActionState } from "./debt-account-action-state";

export type DebtAccountEditFormAccount = Pick<
  OwnedDebtAccount,
  | "id"
  | "name"
  | "creditorName"
  | "currentBalanceMinor"
  | "defaultRequiredPaymentMinor"
  | "currencyCode"
>;

export function DebtAccountEditForm({ account }: { readonly account: DebtAccountEditFormAccount }) {
  const [state, action, pending] = useActionState(
    updateDebtAccountAction,
    initialDebtAccountActionState,
  );

  return (
    <form className="debt-account-form debt-account-edit-form" action={action} aria-label={`Edit ${account.name}`}>
      <input type="hidden" name="debtAccountId" value={account.id} />

      <div className="debt-form-grid">
        <div>
          <label htmlFor={`debt-account-${account.id}-name`}>Account name</label>
          <input
            id={`debt-account-${account.id}-name`}
            name="name"
            type="text"
            maxLength={120}
            defaultValue={account.name}
            aria-describedby={`debt-account-${account.id}-name-error`}
            aria-invalid={Boolean(state.fieldErrors?.name)}
            disabled={pending}
            required
          />
          <p id={`debt-account-${account.id}-name-error`} className="field-error">
            {state.fieldErrors?.name ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor={`debt-account-${account.id}-creditor`}>Creditor or lender</label>
          <input
            id={`debt-account-${account.id}-creditor`}
            name="creditorName"
            type="text"
            maxLength={120}
            defaultValue={account.creditorName ?? ""}
            aria-describedby={`debt-account-${account.id}-creditor-error`}
            aria-invalid={Boolean(state.fieldErrors?.creditorName)}
            disabled={pending}
          />
          <p id={`debt-account-${account.id}-creditor-error`} className="field-error">
            {state.fieldErrors?.creditorName ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor={`debt-account-${account.id}-current-balance`}>Current balance</label>
          <input
            id={`debt-account-${account.id}-current-balance`}
            name="currentBalance"
            type="text"
            inputMode="decimal"
            pattern="(0|[1-9][0-9]*)(\.[0-9]+)?"
            defaultValue={formatEditableCurrencyMinorUnits(account.currentBalanceMinor, account.currencyCode)}
            aria-describedby={`debt-account-${account.id}-current-balance-error`}
            aria-invalid={Boolean(state.fieldErrors?.currentBalance)}
            disabled={pending}
            required
          />
          <p id={`debt-account-${account.id}-current-balance-error`} className="field-error">
            {state.fieldErrors?.currentBalance ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor={`debt-account-${account.id}-required-payment`}>Required monthly payment</label>
          <input
            id={`debt-account-${account.id}-required-payment`}
            name="defaultRequiredPayment"
            type="text"
            inputMode="decimal"
            pattern="(0|[1-9][0-9]*)(\.[0-9]+)?"
            defaultValue={formatEditableCurrencyMinorUnits(account.defaultRequiredPaymentMinor, account.currencyCode)}
            aria-describedby={`debt-account-${account.id}-required-payment-error`}
            aria-invalid={Boolean(state.fieldErrors?.defaultRequiredPayment)}
            disabled={pending}
            required
          />
          <p id={`debt-account-${account.id}-required-payment-error`} className="field-error">
            {state.fieldErrors?.defaultRequiredPayment ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor={`debt-account-${account.id}-currency`}>Currency</label>
          <input
            id={`debt-account-${account.id}-currency`}
            name="currencyCode"
            type="text"
            maxLength={3}
            defaultValue={account.currencyCode}
            aria-describedby={`debt-account-${account.id}-currency-error`}
            aria-invalid={Boolean(state.fieldErrors?.currencyCode)}
            disabled={pending}
            required
          />
          <p id={`debt-account-${account.id}-currency-error`} className="field-error">
            {state.fieldErrors?.currencyCode ?? ""}
          </p>
        </div>
      </div>

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
        {pending ? "Saving debt account..." : "Save debt account"}
      </button>
    </form>
  );
}
