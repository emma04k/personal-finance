import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import { err, ok, type Result } from "@/modules/finance/domain/result";
import type {
  CreateCategoryForOwnerInput,
  DuplicateCategoryError,
  OwnedCategory,
  OwnedPlanningRepository,
} from "./owned-planning-repository";

type BudgetCategoryValidationError = Readonly<{
  code:
    | "INVALID_CATEGORY_TYPE"
    | "CATEGORY_NAME_REQUIRED"
    | "CATEGORY_NAME_TOO_LONG"
    | "DUPLICATE_CATEGORY";
  field: "type" | "name";
}>;

export type BudgetCategoryError = BudgetCategoryValidationError;

export type CreateBudgetCategoryResult = Readonly<{
  category: OwnedCategory;
}>;

const allowedCategoryTypes = new Set<OwnedCategory["type"]>([
  "INCOME",
  "EXPENSE",
  "SAVINGS",
  "DEBT_PAYMENT",
]);

export async function createBudgetCategory({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: Pick<OwnedPlanningRepository, "createCategoryForOwner">;
  readonly input: { readonly type: string; readonly name: string };
}): Promise<Result<CreateBudgetCategoryResult, BudgetCategoryError>> {
  if (!isCategoryType(input.type)) {
    return err({ code: "INVALID_CATEGORY_TYPE", field: "type" });
  }

  const name = input.name.trim();
  if (name.length === 0) {
    return err({ code: "CATEGORY_NAME_REQUIRED", field: "name" });
  }

  if (name.length > 120) {
    return err({ code: "CATEGORY_NAME_TOO_LONG", field: "name" });
  }

  try {
    const category = await repository.createCategoryForOwner(owner.userId, {
      type: input.type,
      name,
    });
    return ok({ category });
  } catch (error) {
    if (isDuplicateCategoryError(error)) {
      return err({ code: "DUPLICATE_CATEGORY", field: "name" });
    }
    throw error;
  }
}

function isCategoryType(type: string): type is CreateCategoryForOwnerInput["type"] {
  return allowedCategoryTypes.has(type as OwnedCategory["type"]);
}

function isDuplicateCategoryError(error: unknown): error is DuplicateCategoryError {
  return error instanceof Error && error.name === "DuplicateCategoryError";
}
