"use client";

import { useActionState } from "react";
import { createDebtAccountAction } from "./actions";
import { initialDebtAccountActionState } from "./debt-account-action-state";

export function DebtAccountForm() {
  const [state, action, pending] = useActionState(
    createDebtAccountAction,
    initialDebtAccountActionState,
  );

  return (
    <form className="debt-account-form" action={action}>
      <div className="debt-form-grid">
        <div>
          <label htmlFor="debt-account-name">Account name</label>
          <input
            id="debt-account-name"
            name="name"
            type="text"
            maxLength={120}
            aria-describedby="debt-account-name-error"
            aria-invalid={Boolean(state.fieldErrors?.name)}
            disabled={pending}
            required
          />
          <p id="debt-account-name-error" className="field-error">
            {state.fieldErrors?.name ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor="debt-account-creditor">Creditor or lender</label>
          <input
            id="debt-account-creditor"
            name="creditorName"
            type="text"
            maxLength={120}
            aria-describedby="debt-account-creditor-help debt-account-creditor-error"
            aria-invalid={Boolean(state.fieldErrors?.creditorName)}
            disabled={pending}
          />
          <p id="debt-account-creditor-help" className="field-help">
            Optional. Use the lender name when it helps identify the account.
          </p>
          <p id="debt-account-creditor-error" className="field-error">
            {state.fieldErrors?.creditorName ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor="debt-account-current-balance">Current balance</label>
          <input
            id="debt-account-current-balance"
            name="currentBalance"
            type="text"
            inputMode="decimal"
            pattern="(0|[1-9][0-9]*)(\.[0-9]+)?"
            placeholder="Example: 12500.75"
            aria-describedby="debt-account-current-balance-help debt-account-current-balance-error"
            aria-invalid={Boolean(state.fieldErrors?.currentBalance)}
            disabled={pending}
            required
          />
          <p id="debt-account-current-balance-help" className="field-help">
            Enter the amount without thousands separators.
          </p>
          <p id="debt-account-current-balance-error" className="field-error">
            {state.fieldErrors?.currentBalance ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor="debt-account-required-payment">Required monthly payment</label>
          <input
            id="debt-account-required-payment"
            name="defaultRequiredPayment"
            type="text"
            inputMode="decimal"
            pattern="(0|[1-9][0-9]*)(\.[0-9]+)?"
            placeholder="Example: 150.25"
            aria-describedby="debt-account-required-payment-help debt-account-required-payment-error"
            aria-invalid={Boolean(state.fieldErrors?.defaultRequiredPayment)}
            disabled={pending}
            required
          />
          <p id="debt-account-required-payment-help" className="field-help">
            This is the default required payment used for list review.
          </p>
          <p id="debt-account-required-payment-error" className="field-error">
            {state.fieldErrors?.defaultRequiredPayment ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor="debt-account-currency">Currency</label>
          <input
            id="debt-account-currency"
            name="currencyCode"
            type="text"
            maxLength={3}
            placeholder="USD"
            aria-describedby="debt-account-currency-help debt-account-currency-error"
            aria-invalid={Boolean(state.fieldErrors?.currencyCode)}
            disabled={pending}
            required
          />
          <p id="debt-account-currency-help" className="field-help">
            Supported examples include COP, JPY, KWD, and USD.
          </p>
          <p id="debt-account-currency-error" className="field-error">
            {state.fieldErrors?.currencyCode ?? ""}
          </p>
        </div>
      </div>

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
        {pending ? "Creating debt account..." : "Create debt account"}
      </button>
    </form>
  );
}
