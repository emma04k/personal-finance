import { describe, expect, it, vi } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import { createBudgetCategory } from "@/modules/budget/application/budget-category-workflow";
import type { OwnedPlanningRepository } from "@/modules/budget/application/owned-planning-repository";

const owner: OwnershipContext = {
  userId: "00000000-0000-0000-0000-000000000001",
  role: "OWNER",
  email: "owner@example.test",
};

describe("budget category workflow", () => {
  it("rejects invalid category types before repository writes", async () => {
    const repository = {
      createCategoryForOwner: vi.fn(),
    } as unknown as Pick<OwnedPlanningRepository, "createCategoryForOwner">;

    const result = await createBudgetCategory({
      owner,
      repository,
      input: { type: "TRANSFER", name: "Groceries" },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_CATEGORY_TYPE", field: "type" },
    });
    expect(repository.createCategoryForOwner).not.toHaveBeenCalled();
  });

  it.each([
    { name: "empty names", inputName: "   ", error: { code: "CATEGORY_NAME_REQUIRED", field: "name" } },
    { name: "overlong names", inputName: "x".repeat(121), error: { code: "CATEGORY_NAME_TOO_LONG", field: "name" } },
  ] as const)("rejects $name before repository writes", async ({ inputName, error }) => {
    const repository = {
      createCategoryForOwner: vi.fn(),
    } as unknown as Pick<OwnedPlanningRepository, "createCategoryForOwner">;

    const result = await createBudgetCategory({
      owner,
      repository,
      input: { type: "EXPENSE", name: inputName },
    });

    expect(result).toEqual({ ok: false, error });
    expect(repository.createCategoryForOwner).not.toHaveBeenCalled();
  });

  it("creates a category from authenticated owner context with a trimmed name", async () => {
    const category = {
      id: "20000000-0000-0000-0000-000000000001",
      userId: owner.userId,
      type: "EXPENSE" as const,
      name: "Groceries",
      sortOrder: 0,
      archivedAt: null,
    };
    const createCategoryForOwner = vi.fn(async () => category);
    const repository = {
      createCategoryForOwner,
    } as unknown as Pick<OwnedPlanningRepository, "createCategoryForOwner">;

    const result = await createBudgetCategory({
      owner,
      repository,
      input: {
        type: "EXPENSE",
        name: "  Groceries  ",
        userId: "00000000-0000-0000-0000-000000000999",
      } as { readonly type: string; readonly name: string; readonly userId: string },
    });

    expect(result).toEqual({ ok: true, value: { category } });
    expect(createCategoryForOwner).toHaveBeenCalledWith(owner.userId, {
      type: "EXPENSE",
      name: "Groceries",
    });
  });

  it("returns typed feedback for duplicate owner type name categories", async () => {
    const repository = {
      createCategoryForOwner: vi.fn(async () => {
        const { DuplicateCategoryError } = await import("@/modules/budget/application/owned-planning-repository");
        throw new DuplicateCategoryError();
      }),
    } as unknown as Pick<OwnedPlanningRepository, "createCategoryForOwner">;

    const result = await createBudgetCategory({
      owner,
      repository,
      input: { type: "EXPENSE", name: "Groceries" },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "DUPLICATE_CATEGORY", field: "name" },
    });
  });
});
