import { describe, expect, it, vi } from "vitest";
import { openMonthlyBudgetPeriod } from "@/modules/budget/application/monthly-planning-workflow";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import type {
  CreatePeriodForOwnerInput,
  OwnedPlanningRepository,
} from "@/modules/budget/application/owned-planning-repository";

const owner: OwnershipContext = {
  userId: "00000000-0000-0000-0000-000000000001",
  role: "OWNER",
  email: "owner@example.test",
};

describe("monthly planning workflow", () => {
  it("creates a monthly period from authenticated owner context and explicit locale choices", async () => {
    const createdPeriod = {
      id: "10000000-0000-0000-0000-000000000001",
      userId: owner.userId,
      monthStart: "2026-03-01",
      currencyCode: "COP",
      timeZone: "America/Bogota",
      note: null,
    };
    const createPeriodForOwner = vi.fn(async () => createdPeriod);
    const repository = {
      findPeriodByMonthForOwner: vi.fn(async () => null),
      createPeriodForOwner,
    } as unknown as OwnedPlanningRepository;

    const result = await openMonthlyBudgetPeriod({
      owner,
      repository,
      input: {
        monthStart: "2026-03-01",
        currencyCode: "COP",
        timeZone: "America/Bogota",
        userId: "00000000-0000-0000-0000-000000000999",
      } as CreatePeriodForOwnerInput & { readonly userId: string },
    });

    expect(result).toEqual({ ok: true, value: { period: createdPeriod, created: true } });
    expect(createPeriodForOwner).toHaveBeenCalledWith(owner.userId, {
      monthStart: "2026-03-01",
      currencyCode: "COP",
      timeZone: "America/Bogota",
      note: null,
    });
  });

  it("opens an existing owner-scoped period without overwriting its identity or locale choices", async () => {
    const existingPeriod = {
      id: "10000000-0000-0000-0000-000000000002",
      userId: owner.userId,
      monthStart: "2026-03-01",
      currencyCode: "USD",
      timeZone: "UTC",
      note: "kept",
    };
    const repository = {
      findPeriodByMonthForOwner: vi.fn(async () => existingPeriod),
      createPeriodForOwner: vi.fn(),
    } as unknown as OwnedPlanningRepository;

    const result = await openMonthlyBudgetPeriod({
      owner,
      repository,
      input: {
        monthStart: "2026-03-01",
        currencyCode: "COP",
        timeZone: "America/Bogota",
        note: "ignored for existing periods",
      },
    });

    expect(result).toEqual({ ok: true, value: { period: existingPeriod, created: false } });
    expect(repository.findPeriodByMonthForOwner).toHaveBeenCalledWith(owner.userId, "2026-03-01");
    expect(repository.createPeriodForOwner).not.toHaveBeenCalled();
  });
});
