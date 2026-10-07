import type { WorkbookImportPreview } from "@/modules/budget/application/workbook-import-preview";
import type { WorkbookImportApplyResult } from "@/modules/budget/application/workbook-import-apply";

export type WorkbookImportPreviewField = "periodId" | "workbook" | "debtAccountId";
export type WorkbookImportPreviewState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Partial<Record<WorkbookImportPreviewField, string>>;
  preview?: WorkbookImportPreview;
  applyResult?: WorkbookImportApplyResult;
}>;

export const initialWorkbookImportPreviewState: WorkbookImportPreviewState = Object.freeze({
  status: "idle",
  message: "",
  fieldErrors: {},
});
