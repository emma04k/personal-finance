import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import { parseCurrencyAmountToMinorUnits } from "@/modules/finance/application/currency-amount";
import { createCurrencyCode, type CurrencyCodeError } from "@/modules/finance/domain/money";
import { err, ok, type Result } from "@/modules/finance/domain/result";
import type {
  OwnedBudgetLine,
  OwnedCategory,
  OwnedPlanningRepository,
} from "./owned-planning-repository";

type PlannedBudgetLineValidationError = Readonly<{
  code:
    | "INVALID_PLANNED_AMOUNT"
    | "PERIOD_NOT_FOUND"
    | "CATEGORY_NOT_FOUND"
    | "CATEGORY_NOT_ACTIVE"
    | "CURRENCY_MISMATCH"
    | "INVALID_CATEGORY_TYPE";
  field: "plannedAmount" | "periodId" | "categoryId" | "currencyCode";
}>;

export type PlannedBudgetLineError = PlannedBudgetLineValidationError | CurrencyCodeError;

export type UpsertPlannedBudgetLineResult = Readonly<{
  budgetLine: OwnedBudgetLine;
}>;

const allowedCategoryTypes = new Set<OwnedCategory["type"]>([
  "INCOME",
  "EXPENSE",
  "SAVINGS",
  "DEBT_PAYMENT",
]);

export async function upsertPlannedBudgetLine({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: Pick<
    OwnedPlanningRepository,
    "findPeriodForOwner" | "findCategoryForOwner" | "upsertPlannedBudgetLineForOwner"
  >;
  readonly input: {
    readonly periodId: string;
    readonly categoryId: string;
    readonly plannedAmount: unknown;
    readonly currencyCode: string;
  };
}): Promise<Result<UpsertPlannedBudgetLineResult, PlannedBudgetLineError>> {
  const currency = createCurrencyCode(input.currencyCode);
  if (!currency.ok) return currency;

  const plannedAmountMinor = parseCurrencyAmountToMinorUnits(input.plannedAmount, currency.value);
  if (plannedAmountMinor === null) {
    return err({ code: "INVALID_PLANNED_AMOUNT", field: "plannedAmount" });
  }

  const period = await repository.findPeriodForOwner(owner.userId, input.periodId);
  if (!period) return err({ code: "PERIOD_NOT_FOUND", field: "periodId" });

  if (period.currencyCode !== currency.value) {
    return err({ code: "CURRENCY_MISMATCH", field: "currencyCode" });
  }

  const category = await repository.findCategoryForOwner(owner.userId, input.categoryId);
  if (!category) return err({ code: "CATEGORY_NOT_FOUND", field: "categoryId" });
  if (category.archivedAt !== null) {
    return err({ code: "CATEGORY_NOT_ACTIVE", field: "categoryId" });
  }
  if (!allowedCategoryTypes.has(category.type)) {
    return err({ code: "INVALID_CATEGORY_TYPE", field: "categoryId" });
  }

  const budgetLine = await repository.upsertPlannedBudgetLineForOwner(owner.userId, {
    periodId: period.id,
    categoryId: category.id,
    plannedAmountMinor,
    currencyCode: currency.value,
  });
  return ok({ budgetLine });
}
