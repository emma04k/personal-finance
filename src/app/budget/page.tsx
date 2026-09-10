import { AppShell } from "@/components/app-shell";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import type {
  OwnedBudgetLine,
  OwnedCategory,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import {
  DEFAULT_BUDGET_TIME_ZONE,
  buildCurrentMonthStartForTimeZone,
} from "@/modules/budget/application/default-budget-period";
import type {
  AggregateMoney,
  BudgetSummary,
  MaybeMoney,
  MaybeRate,
} from "@/modules/budget/domain/budget-summary";
import { buildMonthlyBudgetSummary } from "@/modules/budget/application/monthly-budget-summary-workflow";
import { formatCurrencyMinorUnits } from "@/modules/finance/application/currency-amount";
import type { Money } from "@/modules/finance/domain/money";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { prisma } from "@/lib/prisma";
import { BudgetLineForm } from "./budget-line-form";
import { BudgetCategoryForm } from "./budget-category-form";
import { BudgetPeriodForm } from "./budget-period-form";
import { BudgetTransactionForm } from "./budget-transaction-form";

type BudgetPlanningState =
  | Readonly<{
      status: "authenticated";
      periods: readonly OwnedPeriod[];
      categories: readonly OwnedCategory[];
      plannedBudgetLines: readonly OwnedBudgetLine[];
      transactions: readonly OwnedTransaction[];
      currentPeriod: OwnedPeriod | undefined;
    }>
  | Readonly<{ status: "authentication-required" }>;

export default async function BudgetPage() {
  const state = await loadBudgetPlanningState();

  if (state.status === "authentication-required") {
    return (
      <AppShell activeHref="/budget">
        <section className="budget-page" aria-labelledby="budget-heading">
          <p className="eyebrow">Plan mensual</p>
          <h1 id="budget-heading">Presupuesto</h1>
          <div className="empty-state" role="status">
            <div>
              <h2>Inicia sesión para ver tu planificación.</h2>
              <p>
                El presupuesto solo carga periodos y categorías desde una sesión activa.
              </p>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell activeHref="/budget">
      <BudgetPlanningContent
        periods={state.periods}
        categories={state.categories}
        plannedBudgetLines={state.plannedBudgetLines}
        transactions={state.transactions}
        currentPeriod={state.currentPeriod}
      />
    </AppShell>
  );
}

async function loadBudgetPlanningState(): Promise<BudgetPlanningState> {
  try {
    const owner = await requireCurrentOwnershipContext();
    const repository = new PrismaOwnedPlanningRepository(prisma);
    const [periods, categories] = await Promise.all([
      repository.listPeriodsForOwner(owner.userId),
      repository.listActiveCategoriesForOwner(owner.userId),
    ]);
    const currentMonthStart = buildCurrentMonthStartForTimeZone({
      now: new Date(),
      timeZone: DEFAULT_BUDGET_TIME_ZONE,
    });
    const currentPeriod = periods.find((period) => period.monthStart === currentMonthStart) ?? periods[0];
    const plannedBudgetLines = currentPeriod
      ? await repository.listPlannedBudgetLinesForOwnerPeriod(owner.userId, currentPeriod.id)
      : [];
    const transactions = currentPeriod
      ? await repository.listTransactionsForOwnerPeriod(owner.userId, currentPeriod.id)
      : [];

    return { status: "authenticated", periods, categories, plannedBudgetLines, transactions, currentPeriod };
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

function BudgetPlanningContent({
  categories,
  currentPeriod,
  plannedBudgetLines,
  periods,
  transactions,
}: {
  readonly periods: readonly OwnedPeriod[];
  readonly categories: readonly OwnedCategory[];
  readonly plannedBudgetLines: readonly OwnedBudgetLine[];
  readonly transactions: readonly OwnedTransaction[];
  readonly currentPeriod: OwnedPeriod | undefined;
}) {
  const currentMonthStart = buildCurrentMonthStartForTimeZone({
    now: new Date(),
    timeZone: DEFAULT_BUDGET_TIME_ZONE,
  });
  const hasPeriods = periods.length > 0;
  const hasCategories = categories.some((category) => category.archivedAt === null);
  const monthlySummary = currentPeriod
    ? buildMonthlyBudgetSummary({ period: currentPeriod, plannedBudgetLines, transactions })
    : null;
  const state = { currentPeriod };

  return (
    <section className="budget-page" aria-labelledby="budget-heading">
      <div className="budget-hero">
        <div>
          <p className="eyebrow">Plan mensual</p>
          <h1 id="budget-heading">Presupuesto</h1>
          <p>
            Abre un periodo mensual con moneda y zona horaria explícitas antes de registrar
            montos planeados o reales.
          </p>
        </div>
        <span className="period-chip">
          {hasPeriods ? `${periods.length} periodo${periods.length === 1 ? "" : "s"}` : "Sin periodo"}
        </span>
      </div>

      <MonthlySummarySection currentPeriod={currentPeriod} summaryResult={monthlySummary} />

      <section className="budget-panel" aria-labelledby="create-period-heading">
        <div>
          <p className="eyebrow">Nuevo periodo</p>
          <h2 id="create-period-heading">Crear o abrir mes</h2>
          <p>
            Si el mes ya existe, se conserva su identidad, moneda y zona horaria originales.
          </p>
        </div>

        <BudgetPeriodForm currentMonthStart={currentMonthStart} defaultTimeZone={DEFAULT_BUDGET_TIME_ZONE} />
      </section>

      <section className="budget-panel" aria-labelledby="create-category-heading">
        <div>
          <p className="eyebrow">Nueva categoría</p>
          <h2 id="create-category-heading">Crear categoría</h2>
          <p>
            Usa categorías propias y activas para preparar las próximas líneas planeadas.
          </p>
        </div>

        <BudgetCategoryForm />
      </section>

      <section
        className="budget-panel"
        aria-labelledby="budget-line-form-heading"
        data-current-period-id={currentPeriod?.id ?? ""}
      >
        <div>
          <p className="eyebrow">Montos planeados</p>
          <h2 id="budget-line-form-heading">Agregar o actualizar monto</h2>
          <p>
            Elige un mes y una categoría activa para guardar el monto que quieres planear.
          </p>
        </div>

        <BudgetLineForm
          categories={categories}
          currentPeriod={state.currentPeriod}
        />
      </section>

      <section
        className="budget-panel"
        aria-labelledby="budget-transaction-form-heading"
        data-current-period-id={currentPeriod?.id ?? ""}
      >
        <div>
          <p className="eyebrow">Transacciones del mes</p>
          <h2 id="budget-transaction-form-heading">Registrar transacción</h2>
          <p>
            Agrega movimientos del mes seleccionado usando categorías activas y la moneda del periodo.
          </p>
        </div>

        <BudgetTransactionForm
          categories={categories}
          currentPeriod={state.currentPeriod}
        />
      </section>

      <section className="budget-status-grid" aria-label="Estado de planificación">
        <article className="summary-card">
          <p>Periodos</p>
          <strong>{hasPeriods ? periods.length : "Sin datos"}</strong>
          <small>{hasPeriods ? formatPeriodLabel(periods[0]) : "Crea tu primer mes para empezar."}</small>
        </article>
        <article className="summary-card">
          <p>Categorías activas</p>
          <strong>{hasCategories ? categories.length : "Sin datos"}</strong>
          <small>
            {hasCategories
              ? "Listas para preparar líneas planeadas."
              : "Aún no hay categorías activas para presupuestar."}
          </small>
        </article>
      </section>

      <section className="budget-panel" aria-labelledby="active-categories-heading">
        <div>
          <p className="eyebrow">Categorías activas</p>
          <h2 id="active-categories-heading">Lista de categorías</h2>
          <p>Solo se muestran tus categorías activas para este presupuesto.</p>
        </div>

        {hasCategories ? (
          <ul className="category-list" aria-label="Categorías activas">
            {categories.map((category) => (
              <li key={category.id} className="category-list-item">
                <span>{category.name}</span>
                <small>{formatCategoryTypeLabel(category.type)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="category-empty" role="status">
            Crea tu primera categoría para organizar el presupuesto.
          </p>
        )}
      </section>

      <section className="budget-panel" aria-labelledby="planned-lines-heading">
        <div>
          <p className="eyebrow">Mes actual</p>
          <h2 id="planned-lines-heading">Líneas planeadas</h2>
          <p>
            Muestra los montos planeados del periodo mensual seleccionado.
          </p>
        </div>

        {plannedBudgetLines.length > 0 ? (
          <ul className="planned-line-list" aria-label="Líneas planeadas del mes actual">
            {plannedBudgetLines.map((budgetLine) => (
              <li key={budgetLine.id} className="planned-line-list-item">
                <span>{budgetLine.categoryName}</span>
                <strong>{formatBudgetLineAmount(budgetLine.plannedAmountMinor, budgetLine.currencyCode)}</strong>
                <small>{formatCategoryTypeLabel(budgetLine.categoryType)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="category-empty" role="status">
            Aún no hay montos planeados para el mes actual.
          </p>
        )}
      </section>

      <section className="budget-panel" aria-labelledby="transactions-heading">
        <div>
          <p className="eyebrow">Mes actual</p>
          <h2 id="transactions-heading">Transacciones registradas</h2>
          <p>
            Muestra los movimientos guardados para el mismo periodo seleccionado.
          </p>
        </div>

        {transactions.length > 0 ? (
          <ul className="transaction-list" aria-label="Transacciones del mes actual">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="transaction-list-item">
                <span>{transaction.description}</span>
                <strong>{formatTransactionAmount(transaction.amountMinor, transaction.currencyCode, transaction.direction)}</strong>
                <small>{transaction.categoryName} · {formatCategoryTypeLabel(transaction.categoryType)} · {transaction.occurredOn}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="category-empty" role="status">
            Aún no hay transacciones para el mes actual.
          </p>
        )}
      </section>

      {!hasPeriods || !hasCategories ? (
        <section className="empty-state budget-empty-state" aria-labelledby="budget-empty-heading">
          <div>
            <h2 id="budget-empty-heading">
              {hasPeriods ? "Faltan categorías para planear." : "Aún no hay periodos mensuales."}
            </h2>
            <p>
              La captura de transacciones sigue deshabilitada hasta completar la base de
              periodos, categorías y líneas planeadas.
            </p>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function MonthlySummarySection({
  currentPeriod,
  summaryResult,
}: {
  readonly currentPeriod: OwnedPeriod | undefined;
  readonly summaryResult: ReturnType<typeof buildMonthlyBudgetSummary> | null;
}) {
  if (!currentPeriod) {
    return (
      <section className="budget-panel" aria-labelledby="monthly-summary-heading">
        <div>
          <p className="eyebrow">Mes actual</p>
          <h2 id="monthly-summary-heading">Resumen mensual</h2>
          <p>No hay un periodo mensual activo para calcular el resumen.</p>
        </div>
      </section>
    );
  }

  if (summaryResult === null || !summaryResult.ok) {
    return (
      <section className="budget-panel" aria-labelledby="monthly-summary-heading">
        <div>
          <p className="eyebrow">Mes actual</p>
          <h2 id="monthly-summary-heading">Resumen mensual</h2>
          <p role="status">
            No se pudo calcular el resumen con los montos del periodo seleccionado.
          </p>
        </div>
      </section>
    );
  }

  const summary: BudgetSummary = summaryResult.value;

  return (
    <section className="budget-panel" aria-labelledby="monthly-summary-heading">
      <div>
        <p className="eyebrow">Mes actual</p>
        <h2 id="monthly-summary-heading">Resumen mensual</h2>
        <p>
          Combina líneas planeadas y transacciones del periodo seleccionado con datos
          autorizados para este presupuesto.
        </p>
      </div>

      <section className="budget-status-grid" aria-label="Indicadores del resumen mensual">
        <article className="summary-card">
          <p>Saldo disponible</p>
          <strong>{formatMoney(summary.availableBalance)}</strong>
          <small>Ingresos menos gastos, deuda y ahorro del mes.</small>
        </article>
        <article className="summary-card">
          <p>Salida total</p>
          <strong>{formatMoney(summary.totalCashOutflow.amount)}</strong>
          <small>{formatAggregateDetail(summary.totalCashOutflow)}</small>
        </article>
      </section>

      <ul className="planned-line-list" aria-label="Grupos planeados y reales del mes">
        <MonthlySummaryGroup label="Ingresos" aggregate={summary.income} />
        <MonthlySummaryGroup label="Gastos" aggregate={summary.consumptionExpenses} />
        <MonthlySummaryGroup label="Pagos de deuda" aggregate={summary.debtPayments} />
        <MonthlySummaryGroup label="Ahorro" aggregate={summary.savingsAllocations} />
      </ul>

      <ul className="planned-line-list" aria-label="Variaciones y tasas del mes">
        <SummaryMetric label="Variación de ingresos" value={formatMaybeMoney(summary.incomeVariance)} />
        <SummaryMetric label="Variación de egresos" value={formatMaybeMoney(summary.expenseVariance)} />
        <SummaryMetric label="Tasa de salida total" value={formatMaybeRate(summary.totalOutflowRate)} />
        <SummaryMetric label="Tasa de ahorro" value={formatMaybeRate(summary.savingsRate)} />
      </ul>
    </section>
  );
}

function MonthlySummaryGroup({
  aggregate,
  label,
}: {
  readonly label: string;
  readonly aggregate: AggregateMoney;
}) {
  return (
    <li className="planned-line-list-item">
      <span>{label}</span>
      <strong>{formatMoney(aggregate.amount)}</strong>
      <small>{formatAggregateDetail(aggregate)}</small>
    </li>
  );
}

function SummaryMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <li className="planned-line-list-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
  );
}

function formatAggregateDetail(aggregate: AggregateMoney) {
  const completeness = formatCompletenessLabel(aggregate.completeness);
  return aggregate.plannedValuesUsed
    ? `${completeness} · Usa valores planeados donde falta el real.`
    : completeness;
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

function formatMaybeMoney(value: MaybeMoney) {
  return value.available ? formatMoney(value.value) : formatRateUnavailableReason(value.reason);
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

function formatBudgetLineAmount(plannedAmountMinor: string, currencyCode: string) {
  return formatCurrencyMinorUnits(plannedAmountMinor, currencyCode);
}

function formatTransactionAmount(
  amountMinor: string,
  currencyCode: string,
  direction: OwnedTransaction["direction"],
) {
  const signedAmountMinor = direction === "OUTFLOW" ? `-${amountMinor}` : amountMinor;
  return formatCurrencyMinorUnits(signedAmountMinor, currencyCode);
}

function formatCategoryTypeLabel(type: OwnedCategory["type"]) {
  switch (type) {
    case "INCOME":
      return "Ingreso";
    case "EXPENSE":
      return "Gasto";
    case "SAVINGS":
      return "Ahorro";
    case "DEBT_PAYMENT":
      return "Pago de deuda";
  }
}
