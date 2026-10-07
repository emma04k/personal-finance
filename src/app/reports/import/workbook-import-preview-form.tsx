"use client";

import { useActionState } from "react";
import {
  applyWorkbookImportAction,
  previewWorkbookImportAction,
} from "./actions";
import { initialWorkbookImportPreviewState } from "./workbook-import-preview-action-state";
import type {
  WorkbookImportIssue,
  WorkbookImportPreviewRowType,
} from "@/modules/budget/application/workbook-import-preview";

type PeriodOption = Readonly<{
  id: string;
  label: string;
  currencyCode: string;
}>;

export function WorkbookImportPreviewForm({
  periods,
  selectedPeriodId,
}: {
  readonly periods: readonly PeriodOption[];
  readonly selectedPeriodId: string;
}) {
  const [state, action, pending] = useActionState(
    previewWorkbookImportAction,
    initialWorkbookImportPreviewState,
  );
  const [applyState, applyAction, applyPending] = useActionState(
    applyWorkbookImportAction,
    initialWorkbookImportPreviewState,
  );
  const canApplyPreview = state.preview
    ? !state.preview.issues.some(isBlockingPlannedImportIssue) && state.preview.rows.some((row) => row.type === "planned-income" || row.type === "planned-expense")
    : false;

  return (
    <div className="reports-panel" aria-labelledby="import-preview-form-heading">
      <div>
        <p className="eyebrow">Previsualizar importación</p>
        <h2 id="import-preview-form-heading">Workbook Presupuesto-EDOG.xlsx</h2>
        <p>
          Sube un archivo .xlsx con las hojas Formato Presupuesto y DIAGNOSTICO DE DEUDA.
          Esta fase muestra ingresos, gastos y diagnóstico de deuda como vista previa; no guarda cambios.
        </p>
      </div>

      <form className="reports-period-form" action={action}>
        <label htmlFor="import-period-id">Periodo destino</label>
        <select id="import-period-id" name="periodId" defaultValue={selectedPeriodId}>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label} · {period.currencyCode}
            </option>
          ))}
        </select>
        {state.fieldErrors.periodId ? <p role="alert">{state.fieldErrors.periodId}</p> : null}

        <label htmlFor="import-workbook">Archivo workbook .xlsx</label>
        <input
          id="import-workbook"
          name="workbook"
          type="file"
          accept=".xlsx"
          required
        />
        <p>Máximo 2 MB. Las fórmulas, macros y vínculos externos no se ejecutan.</p>
        {state.fieldErrors.workbook ? <p role="alert">{state.fieldErrors.workbook}</p> : null}

        <button type="submit" disabled={pending}>{pending ? "Previsualizando…" : "Generar vista previa"}</button>
      </form>

      {state.message ? <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}

      {state.preview ? (
        <div className="import-preview-results" aria-live="polite">
          <h3>Filas propuestas</h3>
          {state.preview.rows.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Monto menor</th>
                  <th>Moneda</th>
                </tr>
              </thead>
              <tbody>
                {state.preview.rows.map((row) => (
                  <tr key={`${row.type}-${row.rowNumber}-${row.description}`}>
                    <td>{row.rowNumber}</td>
                    <td>{previewTypeLabel(row.type)}</td>
                    <td>{row.description}</td>
                    <td>{row.amountMinor}</td>
                    <td>{row.currencyCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No hay filas completas para previsualizar.</p>
          )}

          {state.preview.debtDiagnostic ? (
            <section aria-labelledby="debt-diagnostic-preview-heading">
              <h3 id="debt-diagnostic-preview-heading">Diagnóstico de deuda</h3>
              <dl>
                <div>
                  <dt>Ingreso neto</dt>
                  <dd>
                    {state.preview.debtDiagnostic.netIncome
                      ? `${state.preview.debtDiagnostic.netIncome.amountMinor} ${state.preview.debtDiagnostic.netIncome.currencyCode}`
                      : "No disponible"}
                  </dd>
                </div>
              </dl>

              <h4>Candidatos de pago de deuda</h4>
              {state.preview.debtDiagnostic.paymentCandidates.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Concepto</th>
                      <th>Monto menor</th>
                      <th>Moneda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.preview.debtDiagnostic.paymentCandidates.map((candidate) => (
                      <tr key={`${candidate.rowNumber}-${candidate.label}`}>
                        <td>{candidate.rowNumber}</td>
                        <td>{candidate.label}</td>
                        <td>{candidate.amountMinor}</td>
                        <td>{candidate.currencyCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No hay pagos de deuda completos para previsualizar.</p>
              )}
            </section>
          ) : null}

          <h3>Filas marcadas</h3>
          {state.preview.issues.length > 0 ? (
            <ul>
              {state.preview.issues.map((issue, index) => (
                <li key={`${issue.code}-${issue.rowNumber ?? "workbook"}-${index}`}>{issueLabel(issue)}</li>
              ))}
            </ul>
          ) : (
            <p>No se encontraron filas incompletas, ambiguas, duplicadas o no soportadas.</p>
          )}

          {canApplyPreview ? (
            <form className="reports-period-form" action={applyAction}>
              <h3>Confirmar importación</h3>
              <p>
                Vuelve a seleccionar el mismo workbook para revalidarlo en el servidor. Solo se
                guardarán filas de Ingreso planeado y Gasto planeado.
              </p>

              <label htmlFor="apply-import-period-id">Periodo destino</label>
              <select id="apply-import-period-id" name="periodId" defaultValue={selectedPeriodId}>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label} · {period.currencyCode}
                  </option>
                ))}
              </select>
              {applyState.fieldErrors.periodId ? <p role="alert">{applyState.fieldErrors.periodId}</p> : null}

              <label htmlFor="apply-import-workbook">Archivo workbook .xlsx</label>
              <input
                id="apply-import-workbook"
                name="workbook"
                type="file"
                accept=".xlsx"
                required
              />
              {applyState.fieldErrors.workbook ? <p role="alert">{applyState.fieldErrors.workbook}</p> : null}

              <button type="submit" disabled={applyPending}>
                {applyPending ? "Importando…" : "Confirmar e importar filas planeadas"}
              </button>
            </form>
          ) : null}

          {applyState.message ? <p role={applyState.status === "error" ? "alert" : "status"}>{applyState.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function previewTypeLabel(type: WorkbookImportPreviewRowType) {
  switch (type) {
    case "planned-income":
      return "Ingreso planeado";
    case "actual-income":
      return "Ingreso real";
    case "planned-expense":
      return "Gasto planeado";
    case "actual-expense":
      return "Gasto real";
  }
}

function issueTypeLabel(type: NonNullable<WorkbookImportIssue["type"]>) {
  switch (type) {
    case "debt-net-income":
      return "Ingreso neto";
    case "debt-payment-candidate":
      return "Pago de deuda";
    default:
      return previewTypeLabel(type);
  }
}

function isBlockingPlannedImportIssue(issue: WorkbookImportIssue) {
  if (issue.type === "debt-net-income" || issue.type === "debt-payment-candidate") return false;
  if (issue.sheetName === "DIAGNOSTICO DE DEUDA") return false;
  return true;
}

function issueLabel(issue: WorkbookImportIssue) {
  const row = issue.rowNumber ? `Fila ${issue.rowNumber}: ` : "";
  const type = issue.type ? `${issueTypeLabel(issue.type)} — ` : "";
  switch (issue.code) {
    case "MALFORMED_WORKBOOK":
      return "El archivo .xlsx está malformado o no se puede leer.";
    case "UNSUPPORTED_SHEET":
      return "No se encontró la hoja Formato Presupuesto.";
    case "MISSING_HEADER":
      return "No se encontró el encabezado esperado de Formato Presupuesto.";
    case "UNKNOWN_CURRENCY":
      return "La moneda del periodo no está soportada para importación.";
    case "INCOMPLETE_ROW":
      return `${row}${type}faltan descripción o monto.`;
    case "DUPLICATE_ROW":
      return `${row}${type}fila duplicada.`;
    case "INVALID_MONEY":
      return `${row}${type}monto inválido o no canónico.`;
    case "UNSUPPORTED_FORMULA":
      return `${row}${type}las fórmulas no se importan.`;
    case "UNSUPPORTED_WORKBOOK_FEATURE":
      return "Se ignoraron macros o vínculos externos no soportados.";
  }
}
