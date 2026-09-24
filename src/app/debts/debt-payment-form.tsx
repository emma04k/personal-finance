"use client";

import { useActionState } from "react";
import { recordDebtPaymentAction } from "./actions";
import { initialDebtPaymentActionState } from "./debt-payment-action-state";

export type DebtPaymentFormAccount = Readonly<{
  id: string;
  name: string;
  currencyCode: string;
}>;

export type DebtPaymentFormPeriod = Readonly<{
  id: string;
  monthStart: string;
  currencyCode: string;
}>;

export function DebtPaymentForm({
  accounts,
  periods,
}: {
  readonly accounts: readonly DebtPaymentFormAccount[];
  readonly periods: readonly DebtPaymentFormPeriod[];
}) {
  const [state, action, pending] = useActionState(
    recordDebtPaymentAction,
    initialDebtPaymentActionState,
  );
  const disabled = pending || accounts.length === 0 || periods.length === 0;

  return (
    <form className="debt-account-form" action={action}>
      <div className="debt-form-grid">
        <div>
          <label htmlFor="debt-payment-account">Debt account</label>
          <select
            id="debt-payment-account"
            name="debtAccountId"
            aria-describedby="debt-payment-account-error"
            aria-invalid={Boolean(state.fieldErrors?.debtAccountId)}
            disabled={disabled}
            required
          >
            <option value="">Select an active debt account</option>
            {accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.name} ({account.currencyCode})
              </option>
            ))}
          </select>
          <p id="debt-payment-account-error" className="field-error">
            {state.fieldErrors?.debtAccountId ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor="debt-payment-period">Monthly period</label>
          <select
            id="debt-payment-period"
            name="periodId"
            aria-describedby="debt-payment-period-error"
            aria-invalid={Boolean(state.fieldErrors?.periodId)}
            disabled={disabled}
            required
          >
            <option value="">Select a monthly period</option>
            {periods.map((period) => (
              <option value={period.id} key={period.id}>
                {formatPeriodLabel(period)} ({period.currencyCode})
              </option>
            ))}
          </select>
          <p id="debt-payment-period-error" className="field-error">
            {state.fieldErrors?.periodId ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor="debt-payment-amount">Payment amount</label>
          <input
            id="debt-payment-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            pattern="(0|[1-9][0-9]*)(\.[0-9]+)?"
            placeholder="Example: 150.25"
            aria-describedby="debt-payment-amount-help debt-payment-amount-error"
            aria-invalid={Boolean(state.fieldErrors?.amount)}
            disabled={disabled}
            required
          />
          <p id="debt-payment-amount-help" className="field-help">
            Enter the payment amount without thousands separators.
          </p>
          <p id="debt-payment-amount-error" className="field-error">
            {state.fieldErrors?.amount ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor="debt-payment-paid-on">Paid date</label>
          <input
            id="debt-payment-paid-on"
            name="paidOn"
            type="date"
            aria-describedby="debt-payment-paid-on-error"
            aria-invalid={Boolean(state.fieldErrors?.paidOn)}
            disabled={disabled}
            required
          />
          <p id="debt-payment-paid-on-error" className="field-error">
            {state.fieldErrors?.paidOn ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor="debt-payment-required-override">Required-payment override</label>
          <input
            id="debt-payment-required-override"
            name="requiredPaymentOverride"
            type="text"
            inputMode="decimal"
            pattern="(0|[1-9][0-9]*)(\.[0-9]+)?"
            placeholder="Optional"
            aria-describedby="debt-payment-required-override-help debt-payment-required-override-error"
            aria-invalid={Boolean(state.fieldErrors?.requiredPaymentOverride)}
            disabled={disabled}
          />
          <p id="debt-payment-required-override-help" className="field-help">
            Optional. Leave blank to use the account default.
          </p>
          <p id="debt-payment-required-override-error" className="field-error">
            {state.fieldErrors?.requiredPaymentOverride ?? ""}
          </p>
        </div>

        <div>
          <label htmlFor="debt-payment-notes">Notes</label>
          <textarea
            id="debt-payment-notes"
            name="notes"
            maxLength={500}
            aria-describedby="debt-payment-notes-help debt-payment-notes-error"
            aria-invalid={Boolean(state.fieldErrors?.notes)}
            disabled={disabled}
          />
          <p id="debt-payment-notes-help" className="field-help">
            Optional note for this payment.
          </p>
          <p id="debt-payment-notes-error" className="field-error">
            {state.fieldErrors?.notes ?? ""}
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

      {accounts.length === 0 || periods.length === 0 ? (
        <p className="field-help">Create an active debt account and monthly period before recording payments.</p>
      ) : null}

      <button type="submit" disabled={disabled}>
        {pending ? "Recording payment..." : "Record debt payment"}
      </button>
    </form>
  );
}

function formatPeriodLabel(period: DebtPaymentFormPeriod) {
  return period.monthStart.slice(0, 7);
}
