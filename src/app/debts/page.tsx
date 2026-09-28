import { AppShell } from "@/components/app-shell";
import { formatCurrencyMinorUnits } from "@/modules/finance/application/currency-amount";
import type { DebtBand } from "@/modules/debt/domain/debt-diagnostic";
import type { OwnedDebtAccount } from "@/modules/debt/application/owned-debt-account-repository";
import type { OwnedDebtPaymentHistoryEntry, OwnedDebtPaymentTransactionCandidate } from "@/modules/debt/application/owned-debt-payment-repository";
import type { OwnedPeriod } from "@/modules/budget/application/owned-planning-repository";
import { loadDebtAccountListState, type DebtDiagnosticSummaryState } from "./debt-account-list-state";
import { DebtAccountForm } from "./debt-account-form";
import { DebtAccountEditForm, type DebtAccountEditFormAccount } from "./debt-account-edit-form";
import { DebtAccountArchiveForm, type DebtAccountArchiveFormAccount } from "./debt-account-archive-form";
import { DebtPaymentForm, type DebtPaymentFormAccount, type DebtPaymentFormPeriod, type DebtPaymentFormTransactionCandidate } from "./debt-payment-form";

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
              <DebtDiagnosticSummarySection diagnostic={state.diagnostic} />
              <DebtAccountCreateSection />
              <DebtPaymentSection accounts={state.accounts} periods={state.periods} transactionCandidates={state.transactionCandidates} />
              <DebtPaymentHistorySection payments={state.paymentHistory} />
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

function DebtDiagnosticSummarySection({ diagnostic }: { readonly diagnostic: DebtDiagnosticSummaryState }) {
  if (diagnostic.status === "unavailable") {
    const copy = diagnosticUnavailableCopy(diagnostic.reason);
    return (
      <section className="debt-panel" role="status" aria-labelledby="debt-diagnostic-summary-heading">
        <div>
          <p className="eyebrow">Read-only diagnostic</p>
          <h2 id="debt-diagnostic-summary-heading">Debt diagnostic summary unavailable</h2>
          <p>{copy}</p>
          <p>
            This is an educational signal, not financial advice. It uses actual income only in this slice.
          </p>
        </div>
        <dl>
          <div>
            <dt>Selected period</dt>
            <dd>{diagnostic.period?.label ?? "No monthly period selected"}</dd>
          </div>
          {diagnostic.period ? (
            <div>
              <dt>Period currency</dt>
              <dd>{diagnostic.period.currencyCode}</dd>
            </div>
          ) : null}
          {diagnostic.monthlyRequiredDebtPaymentTotalMinor && diagnostic.period ? (
            <div>
              <dt>Monthly required debt payment total</dt>
              <dd>{formatCurrencyMinorUnits(diagnostic.monthlyRequiredDebtPaymentTotalMinor, diagnostic.period.currencyCode)}</dd>
            </div>
          ) : null}
        </dl>
        {diagnostic.contributors && diagnostic.contributors.length > 0 ? (
          <DiagnosticContributors diagnostic={diagnostic} />
        ) : null}
      </section>
    );
  }

  return (
    <section className="debt-panel" aria-labelledby="debt-diagnostic-summary-heading">
      <div>
        <p className="eyebrow">Read-only diagnostic</p>
        <h2 id="debt-diagnostic-summary-heading">Debt diagnostic summary</h2>
        <p>
          This educational signal, not financial advice, compares active required debt payments with actual income for the selected period.
        </p>
      </div>
      <dl>
        <div>
          <dt>Selected period</dt>
          <dd>{diagnostic.period.label}</dd>
        </div>
        <div>
          <dt>Monthly required debt payment total</dt>
          <dd>{formatCurrencyMinorUnits(diagnostic.monthlyRequiredDebtPaymentTotalMinor, diagnostic.period.currencyCode)}</dd>
        </div>
        <div>
          <dt>Debt-to-income rate</dt>
          <dd>{formatExactPercent(diagnostic.debtToIncomeRate)}</dd>
        </div>
        <div>
          <dt>Diagnostic band</dt>
          <dd>{formatDebtBandLabel(diagnostic.debtBand)}</dd>
        </div>
        <div>
          <dt>Reduction to reach next safer band</dt>
          <dd>
            {formatCurrencyMinorUnits(diagnostic.saferBandMonthlyReductionMinor, diagnostic.period.currencyCode)} toward {formatDebtBandLabel(diagnostic.saferBandTargetBand)}
          </dd>
        </div>
      </dl>
      <DiagnosticContributors diagnostic={diagnostic} />
    </section>
  );
}

function DiagnosticContributors({ diagnostic }: { readonly diagnostic: DebtDiagnosticSummaryState }) {
  if (!diagnostic.contributors || !diagnostic.period) return null;

  return (
    <div className="debt-account-grid" aria-label="Active debt account contributors">
      {diagnostic.contributors.map((contributor) => (
        <article className="debt-account-card" key={contributor.accountId}>
          <div>
            <p className="eyebrow">Contributor</p>
            <h3>{contributor.accountName}</h3>
          </div>
          <dl>
            <div>
              <dt>Required monthly payment</dt>
              <dd>{formatCurrencyMinorUnits(contributor.requiredPaymentMinor, contributor.currencyCode)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

type DebtDiagnosticUnavailableState = Extract<DebtDiagnosticSummaryState, { readonly status: "unavailable" }>;

function diagnosticUnavailableCopy(reason: DebtDiagnosticUnavailableState["reason"]) {
  if (reason === "NO_MONTHLY_PERIOD") return "Create a monthly budget period before reading this diagnostic.";
  if (reason === "NO_ACTIVE_DEBT_ACCOUNTS") return "Add an active debt account before reading this diagnostic.";
  if (reason === "ACTUAL_INCOME_MISSING") return "Record at least one actual income transaction for the selected period before reading this diagnostic.";
  if (reason === "ZERO_ACTUAL_INCOME") return "Actual income is zero for this period, so a debt-to-income rate is not available.";
  return "The diagnostic inputs could not be read safely for this period.";
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

function DebtPaymentSection({
  accounts,
  periods,
  transactionCandidates,
}: {
  readonly accounts: readonly OwnedDebtAccount[];
  readonly periods: readonly OwnedPeriod[];
  readonly transactionCandidates: readonly OwnedDebtPaymentTransactionCandidate[];
}) {
  const paymentAccounts = accounts.map((account) => toDebtPaymentFormAccount(account));
  const paymentPeriods = periods.map((period) => toDebtPaymentFormPeriod(period));
  const paymentTransactionCandidates = transactionCandidates.map((candidate) => toDebtPaymentFormTransactionCandidate(candidate));

  return (
    <section className="debt-panel" aria-labelledby="debt-payment-create-heading">
      <div>
        <p className="eyebrow">Record payment</p>
        <h2 id="debt-payment-create-heading">Record a debt payment</h2>
        <p>
          Store a payment for one active debt account and one monthly period. This records the payment only.
        </p>
      </div>
      <DebtPaymentForm accounts={paymentAccounts} periods={paymentPeriods} transactionCandidates={paymentTransactionCandidates} />
    </section>
  );
}

function DebtPaymentHistorySection({ payments }: { readonly payments: readonly OwnedDebtPaymentHistoryEntry[] }) {
  if (payments.length === 0) {
    return (
      <section className="debt-empty-state" role="status" aria-labelledby="debt-payment-history-empty-heading">
        <div>
          <p className="eyebrow">Payment history</p>
          <h2 id="debt-payment-history-empty-heading">No debt payments are recorded yet.</h2>
          <p>
            Recorded owner debt payments will appear here after the payment form succeeds.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="debt-panel" aria-labelledby="debt-payment-history-heading">
      <div>
        <p className="eyebrow">Payment history</p>
        <h2 id="debt-payment-history-heading">Recorded debt payments</h2>
        <p>
          Read-only payment records for the authenticated owner, ordered by most recent paid date first.
        </p>
      </div>

      <div className="debt-account-grid" aria-label="Recorded debt payments">
        {payments.map((payment) => (
          <article className="debt-account-card" key={payment.id}>
            <div>
              <p className="eyebrow">Account</p>
              <h3>{payment.accountLabel}</h3>
              <small>Period: {formatMonthLabel(payment.periodMonthStart)}</small>
            </div>
            <dl>
              <div>
                <dt>Payment amount</dt>
                <dd>{formatCurrencyMinorUnits(payment.amountMinor, payment.currencyCode)}</dd>
              </div>
              <div>
                <dt>Paid date</dt>
                <dd>{formatDateLabel(payment.paidOn)}</dd>
              </div>
              <div>
                <dt>Required payment override</dt>
                <dd>
                  {payment.requiredPaymentOverrideMinor
                    ? formatCurrencyMinorUnits(payment.requiredPaymentOverrideMinor, payment.currencyCode)
                    : "Not recorded"}
                </dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{payment.notes ?? "No notes recorded"}</dd>
              </div>
              <div>
                <dt>Linked transaction</dt>
                <dd>
                  {payment.linkedTransaction
                    ? `${payment.linkedTransaction.description} on ${formatDateLabel(payment.linkedTransaction.occurredOn)} · ${formatCurrencyMinorUnits(payment.linkedTransaction.amountMinor, payment.linkedTransaction.currencyCode)}`
                    : "No transaction linked"}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
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

function toDebtPaymentFormAccount(account: OwnedDebtAccount): DebtPaymentFormAccount {
  return {
    id: account.id,
    name: account.name,
    currencyCode: account.currencyCode,
  };
}

function toDebtPaymentFormPeriod(period: OwnedPeriod): DebtPaymentFormPeriod {
  return {
    id: period.id,
    monthStart: period.monthStart,
    currencyCode: period.currencyCode,
  };
}

function toDebtPaymentFormTransactionCandidate(candidate: OwnedDebtPaymentTransactionCandidate): DebtPaymentFormTransactionCandidate {
  return {
    id: candidate.id,
    periodId: candidate.periodId,
    occurredOn: candidate.occurredOn,
    description: candidate.description,
    amountMinor: candidate.amountMinor,
    currencyCode: candidate.currencyCode,
    categoryName: candidate.categoryName,
  };
}

function formatDebtAccountStatus(status: OwnedDebtAccount["status"]) {
  if (status === "ACTIVE") return "Active";
  if (status === "PAID_OFF") return "Paid off";
  return "Closed";
}

function formatDebtBandLabel(band: DebtBand) {
  if (band === "stable") return "Stable / ideal";
  if (band === "watch") return "Watch / caution";
  if (band === "strained") return "Strained / capacity exceeded";
  return "Critical / over-indebted";
}

function formatExactPercent(ratio: { readonly numerator: string; readonly denominator: string }) {
  const denominator = BigInt(ratio.denominator);
  if (denominator === BigInt("0")) return "Unavailable";
  const basisPoints = BigInt(ratio.numerator) * BigInt("10000") / denominator;
  const whole = basisPoints / BigInt("100");
  const fractional = (basisPoints % BigInt("100")).toString().padStart(2, "0");
  return `${whole.toString()}.${fractional}%`;
}

function formatMonthLabel(monthStart: string) {
  return monthStart.slice(0, 7);
}

function formatDateLabel(date: string) {
  return date;
}
