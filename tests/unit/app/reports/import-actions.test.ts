import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";

const mocks = vi.hoisted(() => {
  const owner: OwnershipContext = {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "OWNER",
    email: "owner@example.test",
  };
  const period = {
    id: "10000000-0000-0000-0000-000000000001",
    userId: owner.userId,
    monthStart: "2026-03-01",
    currencyCode: "COP",
    timeZone: "America/Bogota",
    note: null,
  };
  const repository = {
    findPeriodForOwner: vi.fn(async (): Promise<typeof period | null> => period),
    listPeriodsForOwner: vi.fn(async () => [period]),
    createCategoryForOwner: vi.fn(),
    upsertPlannedBudgetLineForOwner: vi.fn(),
    createTransactionForOwner: vi.fn(),
  };

  return {
    owner,
    period,
    repository,
    requireCurrentOwnershipContext: vi.fn(async () => owner),
    parseWorkbookImportPreview: vi.fn(async () => ({
      rows: [{ type: "planned-income", rowNumber: 2, description: "Salary", amountMinor: "500000", currencyCode: "COP" }],
      issues: [],
    })),
  };
});

vi.mock("@/modules/auth/application/current-ownership-context", () => ({
  requireCurrentOwnershipContext: mocks.requireCurrentOwnershipContext,
}));

vi.mock("@/modules/budget/infrastructure/prisma-owned-planning-repository", () => ({
  PrismaOwnedPlanningRepository: vi.fn(function PrismaOwnedPlanningRepository() {
    return mocks.repository;
  }),
}));

vi.mock("@/modules/budget/application/workbook-import-preview", () => ({
  parseWorkbookImportPreview: mocks.parseWorkbookImportPreview,
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { previewWorkbookImportAction } from "@/app/reports/import/actions";
import { initialWorkbookImportPreviewState } from "@/app/reports/import/workbook-import-preview-action-state";

const validWorkbook = new File([new Uint8Array([80, 75, 3, 4])], "Presupuesto-EDOG.xlsx", {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});

function previewForm(overrides: Partial<Record<"periodId", string>> = {}, file: File | Blob = validWorkbook) {
  const formData = new FormData();
  formData.set("periodId", overrides.periodId ?? mocks.period.id);
  formData.set("workbook", file);
  return formData;
}

function expectNoPersistenceCalls() {
  expect(mocks.repository.createCategoryForOwner).not.toHaveBeenCalled();
  expect(mocks.repository.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
  expect(mocks.repository.createTransactionForOwner).not.toHaveBeenCalled();
}

describe("workbook import preview action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentOwnershipContext.mockResolvedValue(mocks.owner);
    mocks.repository.findPeriodForOwner.mockResolvedValue(mocks.period);
    mocks.parseWorkbookImportPreview.mockResolvedValue({
      rows: [{ type: "planned-income", rowNumber: 2, description: "Salary", amountMinor: "500000", currencyCode: "COP" }],
      issues: [],
    });
  });

  it("returns an in-memory preview for an authenticated owner period without persistence", async () => {
    const state = await previewWorkbookImportAction(initialWorkbookImportPreviewState, previewForm());

    expect(state).toEqual({
      status: "success",
      message: "Vista previa generada. Revisa las filas antes de importar en una fase futura.",
      fieldErrors: {},
      preview: {
        rows: [{ type: "planned-income", rowNumber: 2, description: "Salary", amountMinor: "500000", currencyCode: "COP" }],
        issues: [],
      },
    });
    expect(mocks.repository.findPeriodForOwner).toHaveBeenCalledWith(mocks.owner.userId, mocks.period.id);
    expect(mocks.parseWorkbookImportPreview).toHaveBeenCalledWith({
      workbook: expect.any(Uint8Array),
      currencyCode: "COP",
    });
    expectNoPersistenceCalls();
  });

  it("fails closed for unauthenticated and inactive users before owner data access", async () => {
    mocks.requireCurrentOwnershipContext.mockRejectedValueOnce(new AuthenticationRequiredError());
    const unauthenticated = await previewWorkbookImportAction(initialWorkbookImportPreviewState, previewForm());
    mocks.requireCurrentOwnershipContext.mockRejectedValueOnce(new UserNotActiveError());
    const inactive = await previewWorkbookImportAction(initialWorkbookImportPreviewState, previewForm());

    expect(unauthenticated.status).toBe("error");
    expect(unauthenticated.message).toBe("Inicia sesión para previsualizar importaciones.");
    expect(inactive.status).toBe("error");
    expect(inactive.message).toBe("Tu usuario no está activo.");
    expect(mocks.repository.findPeriodForOwner).not.toHaveBeenCalled();
    expect(mocks.parseWorkbookImportPreview).not.toHaveBeenCalled();
    expectNoPersistenceCalls();
  });

  it("rejects malformed and cross-owner period identifiers before preview parsing", async () => {
    const malformed = await previewWorkbookImportAction(initialWorkbookImportPreviewState, previewForm({ periodId: "not-a-uuid" }));
    mocks.repository.findPeriodForOwner.mockResolvedValueOnce(null);
    const crossOwner = await previewWorkbookImportAction(
      initialWorkbookImportPreviewState,
      previewForm({ periodId: "10000000-0000-0000-0000-000000000999" }),
    );

    expect(malformed.fieldErrors.periodId).toBe("Selecciona un periodo propio válido.");
    expect(crossOwner.fieldErrors.periodId).toBe("Selecciona un periodo propio válido.");
    expect(mocks.repository.findPeriodForOwner).toHaveBeenCalledTimes(1);
    expect(mocks.repository.findPeriodForOwner).toHaveBeenCalledWith(
      mocks.owner.userId,
      "10000000-0000-0000-0000-000000000999",
    );
    expect(mocks.parseWorkbookImportPreview).not.toHaveBeenCalled();
    expectNoPersistenceCalls();
  });

  it("rejects wrong file types and oversized uploads before parsing", async () => {
    const wrongType = new File([new Uint8Array([1])], "budget.csv", { type: "text/csv" });
    const oversized = new File([new Uint8Array(2_097_153)], "too-large.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const wrongTypeState = await previewWorkbookImportAction(initialWorkbookImportPreviewState, previewForm({}, wrongType));
    const oversizedState = await previewWorkbookImportAction(initialWorkbookImportPreviewState, previewForm({}, oversized));

    expect(wrongTypeState.fieldErrors.workbook).toBe("Sube un archivo .xlsx válido.");
    expect(oversizedState.fieldErrors.workbook).toBe("El archivo .xlsx debe pesar máximo 2 MB.");
    expect(mocks.parseWorkbookImportPreview).not.toHaveBeenCalled();
    expectNoPersistenceCalls();
  });
});
