import { AppShell } from "@/components/app-shell";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import {
  DEFAULT_BUDGET_TIME_ZONE,
  selectDisplayedBudgetPeriod,
} from "@/modules/budget/application/default-budget-period";
import { buildMonthlyBudgetSummary } from "@/modules/budget/application/monthly-budget-summary-workflow";
import type {
  AggregateMoney,
  BudgetSummary,
  MaybeRate,
} from "@/modules/budget/domain/budget-summary";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { formatCurrencyMinorUnits } from "@/modules/finance/application/currency-amount";
import type { Money } from "@/modules/finance/domain/money";
import { prisma } from "@/lib/prisma";

type DashboardState =
  | Readonly<{
      status: "authenticated";
      currentPeriod: OwnedPeriod | undefined;
      plannedBudgetLines: readonly OwnedBudgetLine[];
      transactions: readonly OwnedTransaction[];
    }>
  | Readonly<{ status: "authentication-required" }>;

export default async function DashboardPage() {
  const state = await loadDashboardState();

  if (state.status === "authentication-required") {
    return (
      <AppShell activeHref="/dashboard">
        <section className="dashboard-page" aria-labelledby="dashboard-heading">
          <p className="eyebrow">Dashboard mensual</p>
          <h1 id="dashboard-heading">Dashboard</h1>
          <div className="empty-state" role="status">
            <div>
              <h2>Inicia sesión para ver tu dashboard.</h2>
              <p>El resumen mensual solo carga datos desde una sesión activa.</p>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const { currentPeriod, plannedBudgetLines, transactions } = state;
  const summaryResult = currentPeriod
    ? buildMonthlyBudgetSummary({ period: currentPeriod, plannedBudgetLines, transactions })
    : null;

  return (
    <AppShell activeHref="/dashboard">
      <DashboardContent currentPeriod={currentPeriod} summaryResult={summaryResult} />
    </AppShell>
  );
}

async function loadDashboardState(): Promise<DashboardState> {
  try {
    const owner = await requireCurrentOwnershipContext();
    const repository = new PrismaOwnedPlanningRepository(prisma);
    const periods = await repository.listPeriodsForOwner(owner.userId);
    const currentPeriod = selectDisplayedBudgetPeriod({
      periods,
      now: new Date(),
      timeZone: DEFAULT_BUDGET_TIME_ZONE,
    });
    const plannedBudgetLines = currentPeriod
      ? await repository.listPlannedBudgetLinesForOwnerPeriod(owner.userId, currentPeriod.id)
      : [];
    const transactions = currentPeriod
      ? await repository.listTransactionsForOwnerPeriod(owner.userId, currentPeriod.id)
      : [];

    return { status: "authenticated", currentPeriod, plannedBudgetLines, transactions };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof UserNotActiveError
    ) {
      return { status: "authentication-required" };
    }

    throw error;
  }
}

function DashboardContent({
  currentPeriod,
  summaryResult,
}: {
  readonly currentPeriod: OwnedPeriod | undefined;
  readonly summaryResult: ReturnType<typeof buildMonthlyBudgetSummary> | null;
}) {
  if (!currentPeriod) {
    return (
      <section className="dashboard-page" aria-labelledby="dashboard-heading">
        <div className="dashboard-hero">
          <p className="eyebrow">Dashboard mensual</p>
          <h1 id="dashboard-heading">Dashboard</h1>
        </div>
        <section className="dashboard-panel" role="status" aria-labelledby="dashboard-empty-heading">
          <div>
            <h2 id="dashboard-empty-heading">Sin periodo actual</h2>
            <p>No hay un periodo mensual activo para mostrar el dashboard.</p>
          </div>
        </section>
      </section>
    );
  }

  if (summaryResult === null || !summaryResult.ok) {
    return (
      <section className="dashboard-page" aria-labelledby="dashboard-heading">
        <div className="dashboard-hero">
          <p className="eyebrow">Dashboard mensual</p>
          <h1 id="dashboard-heading">Dashboard</h1>
          <span className="period-chip">{formatPeriodLabel(currentPeriod)}</span>
        </div>
        <section className="dashboard-panel" role="status" aria-labelledby="dashboard-error-heading">
          <div>
            <h2 id="dashboard-error-heading">Resumen no disponible</h2>
            <p>No se pudo calcular el dashboard con seguridad.</p>
          </div>
        </section>
      </section>
    );
  }

  const summary: BudgetSummary = summaryResult.value;

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-heading">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Dashboard mensual</p>
          <h1 id="dashboard-heading">Dashboard</h1>
          <p>Resumen del periodo mostrado por el presupuesto actual.</p>
        </div>
        <span className="period-chip">{formatPeriodLabel(currentPeriod)}</span>
      </div>

      <section className="dashboard-panel" aria-labelledby="dashboard-summary-heading">
        <div>
          <p className="eyebrow">Mes actual</p>
          <h2 id="dashboard-summary-heading">Vista general</h2>
          <p>Indicadores calculados con el mismo resumen determinístico del presupuesto.</p>
        </div>

        <div className="dashboard-card-grid" aria-label="Resumen mensual del periodo actual">
          <DashboardCard
            label="Ingreso real"
            value={formatMoney(summary.income.amount)}
            detail={formatAggregateDetail(summary.income)}
          />
          <DashboardCard
            label="Salida real"
            value={formatMoney(summary.totalCashOutflow.amount)}
            detail={formatAggregateDetail(summary.totalCashOutflow)}
          />
          <DashboardCard
            label="Saldo disponible"
            value={formatMoney(summary.availableBalance)}
            detail={formatAvailableBalanceDetail(summary)}
          />
          <DashboardCard
            label="Tasa de salida total"
            value={formatMaybeRate(summary.totalOutflowRate)}
            detail="Salida total frente al ingreso del mes."
          />
        </div>
      </section>
    </section>
  );
}

function DashboardCard({
  detail,
  label,
  value,
}: {
  readonly detail: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <article className="dashboard-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function formatAggregateDetail(aggregate: AggregateMoney) {
  const completeness = formatCompletenessLabel(aggregate.completeness);
  return aggregate.plannedValuesUsed
    ? `${completeness} · Usa valores planeados donde falta el real.`
    : completeness;
}

function formatAvailableBalanceDetail(summary: BudgetSummary) {
  const hasIncompleteInput = summary.income.completeness !== "complete"
    || summary.consumptionExpenses.completeness !== "complete"
    || summary.debtPayments.completeness !== "complete"
    || summary.savingsAllocations.completeness !== "complete";

  return hasIncompleteInput
    ? "Estimado: hay grupos parciales o sin datos."
    : "Ingresos menos gastos, deuda y ahorro del mes.";
}

function formatCompletenessLabel(completeness: AggregateMoney["completeness"]) {
  switch (completeness) {
    case "complete":
      return "Completo";
    case "partial":
      return "Parcial";
    case "missing":
      return "Sin datos";
  }
}

function formatMaybeRate(value: MaybeRate) {
  if (!value.available) return formatRateUnavailableReason(value.reason);
  const basisPoints = (value.ratio.numerator * BigInt("10000") + value.ratio.denominator / BigInt("2"))
    / value.ratio.denominator;
  const whole = basisPoints / BigInt("100");
  const fraction = (basisPoints % BigInt("100")).toString().padStart(2, "0");
  return `${whole.toString()}.${fraction}%`;
}

function formatRateUnavailableReason(reason: "INCOME_MISSING" | "ZERO_INCOME" | "PARTIAL_DATA" | "ZERO_PLANNED") {
  switch (reason) {
    case "INCOME_MISSING":
      return "No disponible: faltan ingresos.";
    case "ZERO_INCOME":
      return "No disponible: ingreso en cero.";
    case "PARTIAL_DATA":
      return "No disponible: datos parciales.";
    case "ZERO_PLANNED":
      return "No disponible: planeado en cero.";
  }
}

function formatMoney(value: Money) {
  return formatCurrencyMinorUnits(value.minorUnits.toString(), value.currency);
}

function formatPeriodLabel(period: OwnedPeriod) {
  return `${period.monthStart} · ${period.currencyCode} · ${period.timeZone}`;
}
