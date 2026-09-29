import { AppShell } from "@/components/app-shell";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import type { OwnedPeriod } from "@/modules/budget/application/owned-planning-repository";
import {
  DEFAULT_BUDGET_TIME_ZONE,
  selectDisplayedBudgetPeriod,
} from "@/modules/budget/application/default-budget-period";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { prisma } from "@/lib/prisma";

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReportsPageState =
  | Readonly<{
      status: "authenticated";
      periods: readonly OwnedPeriod[];
      selectedPeriod: OwnedPeriod | undefined;
    }>
  | Readonly<{ status: "authentication-required" }>;

export default async function ReportsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly periodId?: string | readonly string[];
  }>;
}) {
  const params = await searchParams;
  const state = await loadReportsPageState(readFirstParam(params.periodId));

  if (state.status === "authentication-required") {
    return (
      <AppShell activeHref="/more">
        <section className="reports-page" aria-labelledby="reports-heading">
          <p className="eyebrow">Reporte mensual</p>
          <h1 id="reports-heading">Reportes</h1>
          <div className="empty-state" role="status">
            <div>
              <h2>Inicia sesión para exportar reportes.</h2>
              <p>Los reportes CSV solo se preparan desde una sesión activa.</p>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const { periods, selectedPeriod } = state;

  return (
    <AppShell activeHref="/more">
      <section className="reports-page" aria-labelledby="reports-heading">
        <p className="eyebrow">Reporte mensual</p>
        <h1 id="reports-heading">Reportes</h1>
        <p>
          Exporta reportes mensuales CSV, XLSX o PDF con metadatos seguros del periodo,
          totales determinísticos, líneas planeadas y transacciones reales en unidades
          menores exactas.
        </p>

        {selectedPeriod ? (
          <div className="reports-panel" aria-labelledby="reports-period-heading">
            <div>
              <p className="eyebrow">Periodo seleccionado</p>
              <h2 id="reports-period-heading">{formatPeriodLabel(selectedPeriod.monthStart)}</h2>
              <p>
                {selectedPeriod.monthStart} · {selectedPeriod.currencyCode} · {selectedPeriod.timeZone}
              </p>
            </div>

            {periods.length > 1 ? (
              <form className="reports-period-form" action="/reports">
                <label htmlFor="reports-period-id">Cambiar periodo</label>
                <select id="reports-period-id" name="periodId" defaultValue={selectedPeriod.id}>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {formatPeriodLabel(period.monthStart)} · {period.currencyCode}
                    </option>
                  ))}
                </select>
                <button type="submit">Ver periodo</button>
              </form>
            ) : null}

            <a
              className="primary-button"
              href={`/reports/export?periodId=${selectedPeriod.id}`}
            >
              Descargar CSV
            </a>
            <a
              className="primary-button"
              href={`/reports/export/xlsx?periodId=${selectedPeriod.id}`}
            >
              Descargar XLSX
            </a>
            <a
              className="primary-button"
              href={`/reports/export/pdf?periodId=${selectedPeriod.id}`}
            >
              Descargar PDF
            </a>
          </div>
        ) : (
          <div className="empty-state" role="status">
            <div>
              <h2>No hay un periodo mensual disponible para exportar.</h2>
              <p>Crea un periodo en Presupuesto antes de descargar reportes.</p>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}

async function loadReportsPageState(selectedPeriodIdFromQuery: string | undefined): Promise<ReportsPageState> {
  try {
    const owner = await requireCurrentOwnershipContext();
    const repository = new PrismaOwnedPlanningRepository(prisma);
    const periods = await repository.listPeriodsForOwner(owner.userId);
    const displayedPeriod = selectDisplayedBudgetPeriod({
      periods,
      now: new Date(),
      timeZone: DEFAULT_BUDGET_TIME_ZONE,
    });

    if (!displayedPeriod) return { status: "authenticated", periods, selectedPeriod: undefined };

    if (selectedPeriodIdFromQuery !== undefined && !canonicalUuid.test(selectedPeriodIdFromQuery)) {
      return { status: "authenticated", periods, selectedPeriod: undefined };
    }

    const selectedPeriodId = selectedPeriodIdFromQuery ?? displayedPeriod.id;
    const selectedPeriod = await repository.findPeriodForOwner(owner.userId, selectedPeriodId);

    return { status: "authenticated", periods, selectedPeriod: selectedPeriod ?? undefined };
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

function readFirstParam(value: string | readonly string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatPeriodLabel(monthStart: string) {
  return monthStart.slice(0, 7);
}
