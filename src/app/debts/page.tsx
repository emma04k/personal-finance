import { AppShell } from "@/components/app-shell";
import { formatCurrencyMinorUnits } from "@/modules/finance/application/currency-amount";
import type { DebtBand } from "@/modules/debt/domain/debt-diagnostic";
import type { OwnedDebtAccount } from "@/modules/debt/application/owned-debt-account-repository";
import { loadDebtAccountListState } from "./debt-account-list-state";
import { DebtAccountForm } from "./debt-account-form";
import { DebtAccountEditForm, type DebtAccountEditFormAccount } from "./debt-account-edit-form";
import { DebtAccountArchiveForm, type DebtAccountArchiveFormAccount } from "./debt-account-archive-form";

const debtDiagnosticBands = [
  {
    band: "stable",
    label: "Stable / ideal",
    range: "0% to 30%",
    description: "Debt takes a controlled share of monthly income.",
  },
  {
    band: "watch",
    label: "Watch / caution",
    range: "More than 30% and up to 40%",
    description: "The load needs closer monitoring before taking on new obligations.",
  },
  {
    band: "strained",
    label: "Strained / capacity exceeded",
    range: "More than 40% and up to 60%",
    description: "Payments may limit other goals and essential monthly expenses.",
  },
  {
    band: "critical",
    label: "Critical / over-indebted",
    range: "More than 60%",
    description: "The monthly load is high and needs careful review of obligations.",
  },
] satisfies ReadonlyArray<{
  readonly band: DebtBand;
  readonly label: string;
  readonly range: string;
  readonly description: string;
}>;

export default async function DebtsPage() {
  const state = await loadDebtAccountListState();

  return (
    <AppShell activeHref="/debts">
      <section className="debt-page" aria-labelledby="debt-diagnostic-heading">
        <div className="debt-hero">
          <div>
            <p className="eyebrow">Financial capacity</p>
            <h1 id="debt-diagnostic-heading">Debt diagnostic</h1>
            <p>
              An educational guide to understand how the deterministic model classifies
              monthly debt load. It is a descriptive signal, not financial advice.
            </p>
          </div>
        </div>

        <section className="debt-panel" aria-labelledby="debt-formula-heading">
          <div>
            <p className="eyebrow">How it is calculated</p>
            <h2 id="debt-formula-heading">Debt to income</h2>
            <p>
              The diagnostic uses monthly debt payments divided by monthly income. The result
              is compared with fixed bands to keep the reading consistent.
            </p>
          </div>
        </section>

        <section className="debt-panel" aria-labelledby="debt-bands-heading">
          <div>
            <p className="eyebrow">Diagnostic bands</p>
            <h2 id="debt-bands-heading">Four model levels</h2>
            <p>
              The bands come from the existing deterministic model and are shown without
              running persisted calculations in this phase.
            </p>
          </div>

          <div className="debt-band-grid" aria-label="Debt diagnostic bands">
            {debtDiagnosticBands.map((item) => (
              <article className="debt-band-card" key={item.band}>
                <p>{item.label}</p>
                <strong>{item.range}</strong>
                <small>{item.description}</small>
              </article>
            ))}
          </div>
        </section>

        {state.status === "authentication-required"
          ? <DebtAuthenticationRequiredState />
          : (
            <>
              <DebtAccountCreateSection />
              <DebtAccountSection accounts={state.accounts} />
            </>
          )}
      </section>
    </AppShell>
  );
}

function DebtAuthenticationRequiredState() {
  return (
    <section className="debt-empty-state" role="status" aria-labelledby="debt-auth-heading">
      <div>
        <p className="eyebrow">Current state</p>
        <h2 id="debt-auth-heading">Sign in to view debt accounts.</h2>
        <p>
          Debt accounts only load from an active authenticated owner session.
        </p>
      </div>
    </section>
  );
}

function DebtAccountCreateSection() {
  return (
    <section className="debt-panel" aria-labelledby="debt-account-create-heading">
      <div>
        <p className="eyebrow">Add account</p>
        <h2 id="debt-account-create-heading">Create a debt account</h2>
        <p>
          Add the account fields needed for the active debt account list. New accounts are stored as active.
        </p>
      </div>
      <DebtAccountForm />
    </section>
  );
}

function DebtAccountSection({ accounts }: { readonly accounts: readonly OwnedDebtAccount[] }) {
  if (accounts.length === 0) {
    return (
      <section className="debt-empty-state" role="status" aria-labelledby="debt-empty-heading">
        <div>
          <p className="eyebrow">Current state</p>
          <h2 id="debt-empty-heading">No debt accounts are configured yet.</h2>
          <p>
            This page did not run a debt calculation. Use the account form to add balances for review here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="debt-panel" aria-labelledby="debt-accounts-heading">
      <div>
        <p className="eyebrow">Persisted accounts</p>
        <h2 id="debt-accounts-heading">Active debt accounts</h2>
        <p>
          These rows show stored account fields for review. They do not calculate a diagnostic level.
        </p>
      </div>

      <div className="debt-account-grid" aria-label="Active debt accounts">
        {accounts.map((account) => (
          <article className="debt-account-card" key={account.id}>
            <div>
              <p className="eyebrow">Account</p>
              <h3>{account.name}</h3>
              <small>{account.creditorName ? `Creditor: ${account.creditorName}` : "Creditor not recorded"}</small>
            </div>
            <dl>
              <div>
                <dt>Current balance</dt>
                <dd>{formatCurrencyMinorUnits(account.currentBalanceMinor, account.currencyCode)}</dd>
              </div>
              <div>
                <dt>Required monthly payment</dt>
                <dd>{formatCurrencyMinorUnits(account.defaultRequiredPaymentMinor, account.currencyCode)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{formatDebtAccountStatus(account.status)}</dd>
              </div>
            </dl>
            <DebtAccountEditForm account={toDebtAccountEditFormAccount(account)} />
            <DebtAccountArchiveForm account={toDebtAccountArchiveFormAccount(account)} />
          </article>
        ))}
      </div>
    </section>
  );
}

function toDebtAccountEditFormAccount(account: OwnedDebtAccount): DebtAccountEditFormAccount {
  return {
    id: account.id,
    name: account.name,
    creditorName: account.creditorName,
    currentBalanceMinor: account.currentBalanceMinor,
    defaultRequiredPaymentMinor: account.defaultRequiredPaymentMinor,
    currencyCode: account.currencyCode,
  };
}

function toDebtAccountArchiveFormAccount(account: OwnedDebtAccount): DebtAccountArchiveFormAccount {
  return {
    id: account.id,
    name: account.name,
  };
}

function formatDebtAccountStatus(status: OwnedDebtAccount["status"]) {
  if (status === "ACTIVE") return "Active";
  if (status === "PAID_OFF") return "Paid off";
  return "Closed";
}
