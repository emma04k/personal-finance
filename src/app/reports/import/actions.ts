"use server";

import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import {
  parseWorkbookImportPreview,
} from "@/modules/budget/application/workbook-import-preview";
import { applyPlannedWorkbookImport } from "@/modules/budget/application/workbook-import-apply";
import { prisma } from "@/lib/prisma";
import type {
  WorkbookImportPreviewField,
  WorkbookImportPreviewState,
} from "./workbook-import-preview-action-state";

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxWorkbookUploadBytes = 2 * 1024 * 1024;

export async function previewWorkbookImportAction(
  previousState: WorkbookImportPreviewState,
  formData: FormData,
): Promise<WorkbookImportPreviewState> {
  void previousState;

  let owner;
  try {
    owner = await requireCurrentOwnershipContext();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return actionError("Inicia sesión para previsualizar importaciones.");
    }
    if (error instanceof UserNotActiveError) {
      return actionError("Tu usuario no está activo.");
    }
    throw error;
  }

  const periodId = stringField(formData, "periodId");
  if (!canonicalUuid.test(periodId)) {
    return actionError("Selecciona un periodo propio válido.", { periodId: "Selecciona un periodo propio válido." });
  }

  const workbookFile = workbookFileField(formData);
  if (!workbookFile) {
    return actionError("Sube un archivo .xlsx válido.", { workbook: "Sube un archivo .xlsx válido." });
  }
  const workbookError = validateWorkbookFile(workbookFile);
  if (workbookError) return actionError(workbookError, { workbook: workbookError });

  const repository = new PrismaOwnedPlanningRepository(prisma);
  const period = await repository.findPeriodForOwner(owner.userId, periodId);
  if (!period) {
    return actionError("Selecciona un periodo propio válido.", { periodId: "Selecciona un periodo propio válido." });
  }

  const workbook = new Uint8Array(await workbookFile.arrayBuffer());
  const preview = await parseWorkbookImportPreview({ workbook, currencyCode: period.currencyCode });

  return {
    status: "success",
    message: "Vista previa generada. Revisa las filas antes de aplicar la importación.",
    fieldErrors: {},
    preview,
  };
}

export async function applyWorkbookImportAction(
  previousState: WorkbookImportPreviewState,
  formData: FormData,
): Promise<WorkbookImportPreviewState> {
  void previousState;

  let owner;
  try {
    owner = await requireCurrentOwnershipContext();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return actionError("Inicia sesión para aplicar importaciones.");
    }
    if (error instanceof UserNotActiveError) {
      return actionError("Tu usuario no está activo.");
    }
    throw error;
  }

  const periodId = stringField(formData, "periodId");
  if (!canonicalUuid.test(periodId)) {
    return actionError("Selecciona un periodo propio válido.", { periodId: "Selecciona un periodo propio válido." });
  }

  const workbookFile = workbookFileField(formData);
  if (!workbookFile) {
    return actionError("Sube un archivo .xlsx válido.", { workbook: "Sube un archivo .xlsx válido." });
  }
  const workbookError = validateWorkbookFile(workbookFile);
  if (workbookError) return actionError(workbookError, { workbook: workbookError });

  const repository = new PrismaOwnedPlanningRepository(prisma);
  const period = await repository.findPeriodForOwner(owner.userId, periodId);
  if (!period) {
    return actionError("Selecciona un periodo propio válido.", { periodId: "Selecciona un periodo propio válido." });
  }

  const workbook = new Uint8Array(await workbookFile.arrayBuffer());
  const preview = await parseWorkbookImportPreview({ workbook, currencyCode: period.currencyCode });
  const applyResult = await applyPlannedWorkbookImport({ owner, repository, period, preview });
  if (!applyResult.ok) return importApplyErrorState(applyResult.error.code);

  return {
    status: "success",
    message: appliedMessage(applyResult.value),
    fieldErrors: {},
    applyResult: applyResult.value,
  };
}

function actionError(
  message: string,
  fieldErrors: Partial<Record<WorkbookImportPreviewField, string>> = {},
): WorkbookImportPreviewState {
  return { status: "error", message, fieldErrors };
}

function stringField(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

type UploadedWorkbookFile = Readonly<{
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

function workbookFileField(formData: FormData): UploadedWorkbookFile | null {
  const value = formData.get("workbook");
  if (typeof value !== "object" || value === null) return null;
  if (!("name" in value) || !("size" in value) || !("arrayBuffer" in value)) return null;
  if (typeof value.name !== "string" || typeof value.size !== "number") return null;
  if (typeof value.arrayBuffer !== "function") return null;
  return value as UploadedWorkbookFile;
}

function validateWorkbookFile(file: UploadedWorkbookFile) {
  if (file.size <= 0 || !file.name.toLowerCase().endsWith(".xlsx")) {
    return "Sube un archivo .xlsx válido.";
  }
  if (file.size > maxWorkbookUploadBytes) {
    return "El archivo .xlsx debe pesar máximo 2 MB.";
  }
  return null;
}

function importApplyErrorState(errorCode: "BLOCKING_PREVIEW_ISSUES" | "CURRENCY_MISMATCH") {
  switch (errorCode) {
    case "BLOCKING_PREVIEW_ISSUES":
      return actionError("No se aplicó la importación porque la vista previa contiene bloqueos.", {
        workbook: "Corrige las filas bloqueadas antes de aplicar.",
      });
    case "CURRENCY_MISMATCH":
      return actionError("La moneda del workbook no coincide con el periodo seleccionado.", {
        workbook: "Sube un workbook compatible con la moneda del periodo.",
      });
  }
}

function appliedMessage(result: {
  readonly plannedRowsApplied: number;
  readonly categoriesCreated: number;
  readonly budgetLinesUpserted: number;
}) {
  return `Importación aplicada: ${result.plannedRowsApplied} filas planeadas, ${result.categoriesCreated} categoría${result.categoriesCreated === 1 ? "" : "s"} creada${result.categoriesCreated === 1 ? "" : "s"} y ${result.budgetLinesUpserted} líneas planeadas actualizadas.`;
}
