import type { WorkbookImportPreview } from "@/modules/budget/application/workbook-import-preview";

export type WorkbookImportPreviewField = "periodId" | "workbook";
export type WorkbookImportPreviewState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Partial<Record<WorkbookImportPreviewField, string>>;
  preview?: WorkbookImportPreview;
}>;

export const initialWorkbookImportPreviewState: WorkbookImportPreviewState = Object.freeze({
  status: "idle",
  message: "",
  fieldErrors: {},
});
