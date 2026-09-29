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
import { WorkbookImportPreviewForm } from "./workbook-import-preview-form";

type ReportsImportPageState =
  | Readonly<{
      status: "authenticated";
      periods: readonly OwnedPeriod[];
      selectedPeriod: OwnedPeriod | undefined;
    }>
  | Readonly<{ status: "authentication-required" }>;

export default async function ReportsImportPage() {
  const state = await loadReportsImportPageState();

  if (state.status === "authentication-required") {
    return (
      <AppShell activeHref="/more">
        <section className="reports-page" aria-labelledby="reports-import-heading">
          <p className="eyebrow">Previsualizar importación</p>
          <h1 id="reports-import-heading">Importar workbook</h1>
          <div className="empty-state" role="status">
            <div>
              <h2>Inicia sesión para previsualizar importaciones.</h2>
              <p>La vista previa solo se prepara desde una sesión activa.</p>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  const { periods, selectedPeriod } = state;
  const periodOptions = periods.map((period) => ({
    id: period.id,
    label: formatPeriodLabel(period.monthStart),
    currencyCode: period.currencyCode,
  }));

  return (
    <AppShell activeHref="/more">
      <section className="reports-page" aria-labelledby="reports-import-heading">
        <p className="eyebrow">Previsualizar importación</p>
        <h1 id="reports-import-heading">Importar workbook</h1>
        <p>
          Previsualiza datos del workbook Presupuesto-EDOG.xlsx antes de cualquier flujo de
          confirmación. Esta fase lee solo la hoja Formato Presupuesto y no persiste filas.
        </p>

        {selectedPeriod ? (
          <WorkbookImportPreviewForm
            periods={periodOptions}
            selectedPeriodId={selectedPeriod.id}
          />
        ) : (
          <div className="empty-state" role="status">
            <div>
              <h2>No hay un periodo mensual disponible para previsualizar.</h2>
              <p>Crea un periodo en Presupuesto antes de subir un workbook.</p>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}

async function loadReportsImportPageState(): Promise<ReportsImportPageState> {
  try {
    const owner = await requireCurrentOwnershipContext();
    const repository = new PrismaOwnedPlanningRepository(prisma);
    const periods = await repository.listPeriodsForOwner(owner.userId);
    const selectedPeriod = selectDisplayedBudgetPeriod({
      periods,
      now: new Date(),
      timeZone: DEFAULT_BUDGET_TIME_ZONE,
    });

    return { status: "authenticated", periods, selectedPeriod };
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

function formatPeriodLabel(monthStart: string) {
  return monthStart.slice(0, 7);
}
