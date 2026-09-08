import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import type { OwnedPlanningRepository } from "@/modules/budget/application/owned-planning-repository";

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
  const repository: Pick<
    OwnedPlanningRepository,
    "findPeriodByMonthForOwner" | "createPeriodForOwner"
  > = {
    findPeriodByMonthForOwner,
    createPeriodForOwner,
  };

  return {
    owner,
    repository,
    findPeriodByMonthForOwner,
    createPeriodForOwner,
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
  createBudgetPeriodAction,
} from "@/app/budget/actions";
import { initialBudgetPeriodActionState } from "@/app/budget/budget-period-action-state";

function periodForm(overrides: Partial<Record<"monthStart" | "currencyCode" | "timeZone" | "note", string>> = {}) {
  const formData = new FormData();
  formData.set("monthStart", overrides.monthStart ?? "2026-03");
  formData.set("currencyCode", overrides.currencyCode ?? "COP");
  formData.set("timeZone", overrides.timeZone ?? "America/Bogota");
  if (overrides.note !== undefined) formData.set("note", overrides.note);
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
});
