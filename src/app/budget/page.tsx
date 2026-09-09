import { AppShell } from "@/components/app-shell";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import type {
  OwnedCategory,
  OwnedPeriod,
} from "@/modules/budget/application/owned-planning-repository";
import {
  DEFAULT_BUDGET_TIME_ZONE,
  buildCurrentMonthStartForTimeZone,
} from "@/modules/budget/application/default-budget-period";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { prisma } from "@/lib/prisma";
import { BudgetPeriodForm } from "./budget-period-form";

type BudgetPlanningState =
  | Readonly<{
      status: "authenticated";
      periods: readonly OwnedPeriod[];
      categories: readonly OwnedCategory[];
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
      <BudgetPlanningContent periods={state.periods} categories={state.categories} />
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

    return { status: "authenticated", periods, categories };
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
  periods,
}: {
  readonly periods: readonly OwnedPeriod[];
  readonly categories: readonly OwnedCategory[];
}) {
  const currentMonthStart = buildCurrentMonthStartForTimeZone({
    now: new Date(),
    timeZone: DEFAULT_BUDGET_TIME_ZONE,
  });
  const hasPeriods = periods.length > 0;
  const hasCategories = categories.length > 0;

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
              ? "Listas para líneas planeadas en el siguiente slice."
              : "Aún no hay categorías activas para presupuestar."}
          </small>
        </article>
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

function formatPeriodLabel(period: OwnedPeriod) {
  return `${period.monthStart} · ${period.currencyCode} · ${period.timeZone}`;
}
