import { AppShell } from "@/components/app-shell";
import type { DebtBand } from "@/modules/debt/domain/debt-diagnostic";

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

export default function DebtsPage() {
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

        <section className="debt-empty-state" role="status" aria-labelledby="debt-empty-heading">
          <div>
            <p className="eyebrow">Current state</p>
            <h2 id="debt-empty-heading">No debt accounts are configured yet.</h2>
            <p>
              This page did not run a debt calculation. Persisted debt account entry will arrive in a later phase.
            </p>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
