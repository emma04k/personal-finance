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
  const repository: Pick<
    OwnedPlanningRepository,
    "findPeriodByMonthForOwner" | "createPeriodForOwner" | "createCategoryForOwner"
  > = {
    findPeriodByMonthForOwner,
    createPeriodForOwner,
    createCategoryForOwner,
  };

  return {
    owner,
    repository,
    findPeriodByMonthForOwner,
    createPeriodForOwner,
    createCategoryForOwner,
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
  createBudgetCategoryAction,
  createBudgetPeriodAction,
} from "@/app/budget/actions";
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
});
