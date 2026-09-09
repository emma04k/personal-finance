import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import {
  DuplicateCategoryError,
  type OwnedPlanningRepository,
} from "@/modules/budget/application/owned-planning-repository";

const mocks = vi.hoisted(() => {
  const owner: OwnershipContext = {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "OWNER",
    email: "owner@example.test",
  };

  const findPeriodByMonthForOwner = vi.fn(async () => null);
  const createPeriodForOwner = vi.fn(async (_ownerUserId: string, input) => ({
    id: "10000000-0000-0000-0000-000000000001",
    userId: owner.userId,
    monthStart: input.monthStart,
    currencyCode: input.currencyCode,
    timeZone: input.timeZone,
    note: input.note ?? null,
  }));
  const createCategoryForOwner = vi.fn(async (_ownerUserId: string, input) => ({
    id: "20000000-0000-0000-0000-000000000001",
    userId: owner.userId,
    type: input.type,
    name: input.name,
    sortOrder: 0,
    archivedAt: null,
  }));
  const findPeriodForOwner = vi.fn(async () => ({
    id: "10000000-0000-0000-0000-000000000001",
    userId: owner.userId,
    monthStart: "2026-03-01",
    currencyCode: "COP",
    timeZone: "America/Bogota",
    note: null,
  }));
  const findCategoryForOwner = vi.fn(async () => ({
    id: "20000000-0000-0000-0000-000000000001",
    userId: owner.userId,
    type: "EXPENSE" as const,
    name: "Groceries",
    sortOrder: 0,
    archivedAt: null,
  }));
  const upsertPlannedBudgetLineForOwner = vi.fn(async (_ownerUserId: string, input) => ({
    id: "30000000-0000-0000-0000-000000000001",
    userId: owner.userId,
    periodId: input.periodId,
    categoryId: input.categoryId,
    categoryName: "Groceries",
    categoryType: "EXPENSE" as const,
    plannedAmountMinor: input.plannedAmountMinor,
    currencyCode: input.currencyCode,
  }));
  const repository: Pick<
    OwnedPlanningRepository,
    | "findPeriodByMonthForOwner"
    | "createPeriodForOwner"
    | "createCategoryForOwner"
    | "findPeriodForOwner"
    | "findCategoryForOwner"
    | "upsertPlannedBudgetLineForOwner"
  > = {
    findPeriodByMonthForOwner,
    createPeriodForOwner,
    createCategoryForOwner,
    findPeriodForOwner,
    findCategoryForOwner,
    upsertPlannedBudgetLineForOwner,
  };

  return {
    owner,
    repository,
    findPeriodByMonthForOwner,
    createPeriodForOwner,
    createCategoryForOwner,
    findPeriodForOwner,
    findCategoryForOwner,
    upsertPlannedBudgetLineForOwner,
    requireCurrentOwnershipContext: vi.fn(async () => owner),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/modules/auth/application/current-ownership-context", () => ({
  requireCurrentOwnershipContext: mocks.requireCurrentOwnershipContext,
}));

vi.mock("@/modules/budget/infrastructure/prisma-owned-planning-repository", () => ({
  PrismaOwnedPlanningRepository: vi.fn(function PrismaOwnedPlanningRepository() {
    return mocks.repository;
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import {
  createBudgetLineAction,
  createBudgetCategoryAction,
  createBudgetPeriodAction,
} from "@/app/budget/actions";
import { initialBudgetLineActionState } from "@/app/budget/budget-line-action-state";
import { initialBudgetCategoryActionState } from "@/app/budget/budget-category-action-state";
import { initialBudgetPeriodActionState } from "@/app/budget/budget-period-action-state";

function periodForm(overrides: Partial<Record<"monthStart" | "currencyCode" | "timeZone" | "note", string>> = {}) {
  const formData = new FormData();
  formData.set("monthStart", overrides.monthStart ?? "2026-03");
  formData.set("currencyCode", overrides.currencyCode ?? "COP");
  formData.set("timeZone", overrides.timeZone ?? "America/Bogota");
  if (overrides.note !== undefined) formData.set("note", overrides.note);
  return formData;
}

function categoryForm(overrides: Partial<Record<"type" | "name", string>> = {}) {
  const formData = new FormData();
  formData.set("type", overrides.type ?? "EXPENSE");
  formData.set("name", overrides.name ?? "Groceries");
  return formData;
}

function budgetLineForm(overrides: Partial<Record<"periodId" | "categoryId" | "plannedAmount" | "currencyCode" | "userId", string>> = {}) {
  const formData = new FormData();
  formData.set("periodId", overrides.periodId ?? "10000000-0000-0000-0000-000000000001");
  formData.set("categoryId", overrides.categoryId ?? "20000000-0000-0000-0000-000000000001");
  formData.set("plannedAmount", overrides.plannedAmount ?? "123.45");
  formData.set("currencyCode", overrides.currencyCode ?? "COP");
  if (overrides.userId !== undefined) formData.set("userId", overrides.userId);
  return formData;
}

describe("budget period server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findPeriodByMonthForOwner.mockResolvedValue(null);
    mocks.createPeriodForOwner.mockImplementation(async (_ownerUserId: string, input) => ({
      id: "10000000-0000-0000-0000-000000000001",
      userId: mocks.owner.userId,
      monthStart: input.monthStart,
      currencyCode: input.currencyCode,
      timeZone: input.timeZone,
      note: input.note ?? null,
    }));
    mocks.createCategoryForOwner.mockImplementation(async (_ownerUserId: string, input) => ({
      id: "20000000-0000-0000-0000-000000000001",
      userId: mocks.owner.userId,
      type: input.type,
      name: input.name,
      sortOrder: 0,
      archivedAt: null,
    }));
    mocks.findPeriodForOwner.mockResolvedValue({
      id: "10000000-0000-0000-0000-000000000001",
      userId: mocks.owner.userId,
      monthStart: "2026-03-01",
      currencyCode: "COP",
      timeZone: "America/Bogota",
      note: null,
    });
    mocks.findCategoryForOwner.mockResolvedValue({
      id: "20000000-0000-0000-0000-000000000001",
      userId: mocks.owner.userId,
      type: "EXPENSE",
      name: "Groceries",
      sortOrder: 0,
      archivedAt: null,
    });
    mocks.upsertPlannedBudgetLineForOwner.mockImplementation(async (_ownerUserId: string, input) => ({
      id: "30000000-0000-0000-0000-000000000001",
      userId: mocks.owner.userId,
      periodId: input.periodId,
      categoryId: input.categoryId,
      categoryName: "Groceries",
      categoryType: "EXPENSE",
      plannedAmountMinor: input.plannedAmountMinor,
      currencyCode: input.currencyCode,
    }));
  });

  it("returns field feedback for an invalid month without accepting a client owner id", async () => {
    const formData = periodForm({ monthStart: "2026-02-02" });
    formData.set("userId", "00000000-0000-0000-0000-000000000999");

    const result = await createBudgetPeriodAction(initialBudgetPeriodActionState, formData);

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { monthStart: "Usa un mes válido." },
    });
    expect(mocks.repository.createPeriodForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns field feedback for unsupported currencies and invalid timezones", async () => {
    await expect(
      createBudgetPeriodAction(initialBudgetPeriodActionState, periodForm({ currencyCode: "EUR" })),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: { currencyCode: "Selecciona una moneda soportada." },
    });

    await expect(
      createBudgetPeriodAction(initialBudgetPeriodActionState, periodForm({ timeZone: "Mars/Base" })),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: { timeZone: "Usa una zona horaria válida." },
    });

    expect(mocks.repository.createPeriodForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns field feedback for malformed currency codes and overlong notes", async () => {
    await expect(
      createBudgetPeriodAction(initialBudgetPeriodActionState, periodForm({ currencyCode: "CO" })),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: { currencyCode: "Usa un código de moneda de tres letras." },
    });

    await expect(
      createBudgetPeriodAction(initialBudgetPeriodActionState, periodForm({ note: "x".repeat(501) })),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: { note: "La nota debe tener máximo 500 caracteres." },
    });

    expect(mocks.repository.createPeriodForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns success feedback and revalidates the budget page when creation succeeds", async () => {
    const result = await createBudgetPeriodAction(
      initialBudgetPeriodActionState,
      periodForm({ note: "Pagos especiales" }),
    );

    expect(result).toMatchObject({
      status: "success",
      message: "Periodo creado.",
    });
    expect(mocks.repository.createPeriodForOwner).toHaveBeenCalledWith(mocks.owner.userId, {
      monthStart: "2026-03-01",
      currencyCode: "COP",
      timeZone: "America/Bogota",
      note: "Pagos especiales",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budget");
  });

  it("creates categories from authenticated owner context without accepting client owner ids", async () => {
    const formData = categoryForm({ type: "EXPENSE", name: "  Groceries  " });
    formData.set("userId", "00000000-0000-0000-0000-000000000999");

    const result = await createBudgetCategoryAction(initialBudgetCategoryActionState, formData);

    expect(result).toMatchObject({
      status: "success",
      message: "Categoría creada.",
    });
    expect(mocks.createCategoryForOwner).toHaveBeenCalledWith(mocks.owner.userId, {
      type: "EXPENSE",
      name: "Groceries",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budget");
  });

  it("returns field feedback for invalid category input without repository writes", async () => {
    await expect(
      createBudgetCategoryAction(initialBudgetCategoryActionState, categoryForm({ type: "TRANSFER" })),
    ).resolves.toMatchObject({
      status: "error",
      message: "Selecciona un tipo de categoría válido.",
      fieldErrors: { type: "Selecciona un tipo de categoría válido." },
    });

    await expect(
      createBudgetCategoryAction(initialBudgetCategoryActionState, categoryForm({ name: "   " })),
    ).resolves.toMatchObject({
      status: "error",
      message: "Escribe un nombre para la categoría.",
      fieldErrors: { name: "Escribe un nombre para la categoría." },
    });

    await expect(
      createBudgetCategoryAction(initialBudgetCategoryActionState, categoryForm({ name: "x".repeat(121) })),
    ).resolves.toMatchObject({
      status: "error",
      message: "El nombre debe tener máximo 120 caracteres.",
      fieldErrors: { name: "El nombre debe tener máximo 120 caracteres." },
    });

    expect(mocks.createCategoryForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns duplicate category feedback without revalidating the budget page", async () => {
    mocks.createCategoryForOwner.mockRejectedValueOnce(new DuplicateCategoryError());

    const result = await createBudgetCategoryAction(
      initialBudgetCategoryActionState,
      categoryForm({ type: "EXPENSE", name: "Groceries" }),
    );

    expect(result).toMatchObject({
      status: "error",
      message: "Ya existe una categoría con ese tipo y nombre.",
      fieldErrors: { name: "Ya existe una categoría con ese tipo y nombre." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows unexpected category creation failures without revalidating", async () => {
    mocks.createCategoryForOwner.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      createBudgetCategoryAction(
        initialBudgetCategoryActionState,
        categoryForm({ type: "EXPENSE", name: "Groceries" }),
      ),
    ).rejects.toThrow("database unavailable");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("saves planned budget lines from authenticated owner context without accepting client owner ids", async () => {
    const result = await createBudgetLineAction(
      initialBudgetLineActionState,
      budgetLineForm({ userId: "00000000-0000-0000-0000-000000000999" }),
    );

    expect(result).toMatchObject({
      status: "success",
      message: "Monto planeado guardado.",
    });
    expect(mocks.upsertPlannedBudgetLineForOwner).toHaveBeenCalledWith(mocks.owner.userId, {
      periodId: "10000000-0000-0000-0000-000000000001",
      categoryId: "20000000-0000-0000-0000-000000000001",
      plannedAmountMinor: "12345",
      currencyCode: "COP",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budget");
  });

  it("returns accessible field feedback for invalid planned amounts without internal jargon", async () => {
    const result = await createBudgetLineAction(
      initialBudgetLineActionState,
      budgetLineForm({ plannedAmount: "001" }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { plannedAmount: expect.stringMatching(/monto/) },
    });
    expect(result.message).not.toMatch(/unidades menores|minor units/i);
    expect(mocks.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns planned amount feedback before writes for non-string FormData values", async () => {
    const formData = budgetLineForm();
    formData.set("plannedAmount", new Blob(["123.45"]));

    const result = await createBudgetLineAction(initialBudgetLineActionState, formData);

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { plannedAmount: expect.stringMatching(/monto/) },
    });
    expect(mocks.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["EURO", "Usa un código de moneda de tres letras."],
    ["EUR", "Selecciona una moneda soportada."],
  ])("returns planned-line currency feedback for %s", async (currencyCode, message) => {
    const result = await createBudgetLineAction(
      initialBudgetLineActionState,
      budgetLineForm({ currencyCode }),
    );

    expect(result).toEqual({
      status: "error",
      message,
      fieldErrors: { currencyCode: message },
    });
    expect(mocks.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["periodId", "Selecciona un periodo propio válido.", (): void => {
      mocks.findPeriodForOwner.mockResolvedValueOnce(null as never);
    }],
    ["categoryId", "Selecciona una categoría propia válida.", (): void => {
      mocks.findCategoryForOwner.mockResolvedValueOnce(null as never);
    }],
    ["categoryId", "Selecciona una categoría activa.", (): void => {
      mocks.findCategoryForOwner.mockResolvedValueOnce({
        id: "20000000-0000-0000-0000-000000000001",
        userId: mocks.owner.userId,
        type: "EXPENSE" as const,
        name: "Groceries",
        sortOrder: 0,
        archivedAt: "2026-04-01T00:00:00.000Z",
      } as never);
    }],
    ["currencyCode", "Usa la misma moneda del periodo seleccionado.", (): void => undefined],
  ] as const)("returns planned-line validation feedback for %s", async (field, message, arrange) => {
    arrange();

    const result = await createBudgetLineAction(
      initialBudgetLineActionState,
      budgetLineForm(field === "currencyCode" ? { currencyCode: "USD" } : {}),
    );

    expect(result).toEqual({
      status: "error",
      message,
      fieldErrors: { [field]: message },
    });
    expect(mocks.upsertPlannedBudgetLineForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows unexpected planned-line repository failures without revalidating", async () => {
    mocks.upsertPlannedBudgetLineForOwner.mockRejectedValueOnce(new Error("planned-line write failed"));

    await expect(
      createBudgetLineAction(initialBudgetLineActionState, budgetLineForm()),
    ).rejects.toThrow("planned-line write failed");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
