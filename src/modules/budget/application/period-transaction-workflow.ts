import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import {
  DEFAULT_BUDGET_TIME_ZONE,
  selectDisplayedBudgetPeriod,
} from "@/modules/budget/application/default-budget-period";
import { parseCurrencyAmountToMinorUnits } from "@/modules/finance/application/currency-amount";
import { createCurrencyCode, type CurrencyCode, type CurrencyCodeError } from "@/modules/finance/domain/money";
import { err, ok, type Result } from "@/modules/finance/domain/result";
import type {
  OwnedCategory,
  OwnedPlanningRepository,
  OwnedTransaction,
} from "./owned-planning-repository";

type PeriodTransactionValidationError = Readonly<{
  code:
    | "INVALID_TRANSACTION_AMOUNT"
    | "PERIOD_NOT_FOUND"
    | "CATEGORY_NOT_FOUND"
    | "CATEGORY_NOT_ACTIVE"
    | "CURRENCY_MISMATCH"
    | "INVALID_CATEGORY_TYPE"
    | "INVALID_OCCURRED_ON"
    | "DATE_OUTSIDE_PERIOD"
    | "DESCRIPTION_REQUIRED"
    | "DESCRIPTION_TOO_LONG"
    | "TRANSACTION_NOT_FOUND";
  field: "amount" | "periodId" | "categoryId" | "currencyCode" | "occurredOn" | "description" | "transactionId";
}>;

export type PeriodTransactionError = PeriodTransactionValidationError | CurrencyCodeError;

export type CreatePeriodTransactionResult = Readonly<{
  transaction: OwnedTransaction;
}>;

export type DeletePeriodTransactionResult = Readonly<{
  deleted: true;
}>;

export type UpdatePeriodTransactionResult = Readonly<{
  transaction: OwnedTransaction;
}>;

const allowedCategoryTypes = new Set<OwnedCategory["type"]>([
  "INCOME",
  "EXPENSE",
  "SAVINGS",
  "DEBT_PAYMENT",
]);

export async function createPeriodTransaction({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: Pick<
    OwnedPlanningRepository,
    "findPeriodForOwner" | "findCategoryForOwner" | "createTransactionForOwner"
  >;
  readonly input: {
    readonly periodId: string;
    readonly categoryId: string;
    readonly amount: unknown;
    readonly currencyCode: string;
    readonly occurredOn: string;
    readonly description: string;
  };
}): Promise<Result<CreatePeriodTransactionResult, PeriodTransactionError>> {
  const draft = validatePeriodTransactionDraft(input);
  if (!draft.ok) return draft;

  const period = await repository.findPeriodForOwner(owner.userId, input.periodId);
  if (!period) return err({ code: "PERIOD_NOT_FOUND", field: "periodId" });

  if (period.currencyCode !== draft.value.currency) {
    return err({ code: "CURRENCY_MISMATCH", field: "currencyCode" });
  }

  const dateValidation = validatePeriodTransactionDate(input.occurredOn, period.monthStart);
  if (!dateValidation.ok) return dateValidation;

  const category = await validatePeriodTransactionCategory({
    categoryId: input.categoryId,
    owner,
    repository,
  });
  if (!category.ok) return category;

  const transaction = await repository.createTransactionForOwner(owner.userId, {
    periodId: period.id,
    categoryId: category.value.id,
    direction: category.value.type === "INCOME" ? "INFLOW" : "OUTFLOW",
    amountMinor: draft.value.amountMinor,
    currencyCode: draft.value.currency,
    occurredOn: input.occurredOn,
    description: draft.value.description,
  });
  return ok({ transaction });
}

export async function updatePeriodTransaction({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: Pick<
    OwnedPlanningRepository,
    "listPeriodsForOwner" | "findCategoryForOwner" | "updateTransactionForOwnerPeriod"
  >;
  readonly input: {
    readonly periodId: string;
    readonly transactionId: string;
    readonly categoryId: string;
    readonly amount: unknown;
    readonly currencyCode: string;
    readonly occurredOn: string;
    readonly description: string;
  };
}): Promise<Result<UpdatePeriodTransactionResult, PeriodTransactionError>> {
  const draft = validatePeriodTransactionDraft(input);
  if (!draft.ok) return draft;

  const periods = await repository.listPeriodsForOwner(owner.userId);
  const displayedPeriod = selectDisplayedBudgetPeriod({
    periods,
    now: new Date(),
    timeZone: DEFAULT_BUDGET_TIME_ZONE,
  });
  if (!displayedPeriod || input.periodId !== displayedPeriod.id) {
    return err({ code: "PERIOD_NOT_FOUND", field: "periodId" });
  }

  if (displayedPeriod.currencyCode !== draft.value.currency) {
    return err({ code: "CURRENCY_MISMATCH", field: "currencyCode" });
  }

  const dateValidation = validatePeriodTransactionDate(input.occurredOn, displayedPeriod.monthStart);
  if (!dateValidation.ok) return dateValidation;

  const category = await validatePeriodTransactionCategory({
    categoryId: input.categoryId,
    owner,
    repository,
  });
  if (!category.ok) return category;

  const transaction = await repository.updateTransactionForOwnerPeriod(owner.userId, {
    periodId: displayedPeriod.id,
    transactionId: input.transactionId,
    categoryId: category.value.id,
    direction: category.value.type === "INCOME" ? "INFLOW" : "OUTFLOW",
    amountMinor: draft.value.amountMinor,
    currencyCode: draft.value.currency,
    occurredOn: input.occurredOn,
    description: draft.value.description,
  });

  if (!transaction) return err({ code: "TRANSACTION_NOT_FOUND", field: "transactionId" });
  return ok({ transaction });
}

export async function deletePeriodTransaction({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: Pick<
    OwnedPlanningRepository,
    "listPeriodsForOwner" | "deleteTransactionForOwnerPeriod"
  >;
  readonly input: {
    readonly periodId: string;
    readonly transactionId: string;
  };
}): Promise<Result<DeletePeriodTransactionResult, PeriodTransactionError>> {
  const periods = await repository.listPeriodsForOwner(owner.userId);
  const displayedPeriod = selectDisplayedBudgetPeriod({
    periods,
    now: new Date(),
    timeZone: DEFAULT_BUDGET_TIME_ZONE,
  });
  if (!displayedPeriod || input.periodId !== displayedPeriod.id) {
    return err({ code: "PERIOD_NOT_FOUND", field: "periodId" });
  }

  const deleted = await repository.deleteTransactionForOwnerPeriod(owner.userId, {
    periodId: displayedPeriod.id,
    transactionId: input.transactionId,
  });

  if (!deleted) return err({ code: "TRANSACTION_NOT_FOUND", field: "transactionId" });
  return ok({ deleted: true });
}

function validatePeriodTransactionDraft(input: {
  readonly amount: unknown;
  readonly currencyCode: string;
  readonly description: string;
}): Result<Readonly<{
  amountMinor: string;
  currency: CurrencyCode;
  description: string;
}>, PeriodTransactionError> {
  const currency = createCurrencyCode(input.currencyCode);
  if (!currency.ok) return currency;

  const amountMinor = parseCurrencyAmountToMinorUnits(input.amount, currency.value);
  if (amountMinor === null || BigInt(amountMinor) <= BigInt("0")) {
    return err({ code: "INVALID_TRANSACTION_AMOUNT", field: "amount" });
  }

  const description = input.description.trim();
  if (description.length === 0) {
    return err({ code: "DESCRIPTION_REQUIRED", field: "description" });
  }
  if (description.length > 255) {
    return err({ code: "DESCRIPTION_TOO_LONG", field: "description" });
  }

  return ok({ amountMinor, currency: currency.value, description });
}

function validatePeriodTransactionDate(
  occurredOn: string,
  monthStart: string,
): Result<true, PeriodTransactionValidationError> {
  if (!isCanonicalDate(occurredOn)) {
    return err({ code: "INVALID_OCCURRED_ON", field: "occurredOn" });
  }
  if (!isDateInsidePeriodMonth(occurredOn, monthStart)) {
    return err({ code: "DATE_OUTSIDE_PERIOD", field: "occurredOn" });
  }
  return ok(true);
}

async function validatePeriodTransactionCategory({
  categoryId,
  owner,
  repository,
}: {
  readonly categoryId: string;
  readonly owner: OwnershipContext;
  readonly repository: Pick<OwnedPlanningRepository, "findCategoryForOwner">;
}): Promise<Result<OwnedCategory, PeriodTransactionValidationError>> {
  const category = await repository.findCategoryForOwner(owner.userId, categoryId);
  if (!category) return err({ code: "CATEGORY_NOT_FOUND", field: "categoryId" });
  if (category.archivedAt !== null) {
    return err({ code: "CATEGORY_NOT_ACTIVE", field: "categoryId" });
  }
  if (!allowedCategoryTypes.has(category.type)) {
    return err({ code: "INVALID_CATEGORY_TYPE", field: "categoryId" });
  }
  return ok(category);
}

function isCanonicalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isDateInsidePeriodMonth(occurredOn: string, monthStart: string) {
  return occurredOn.slice(0, 7) === monthStart.slice(0, 7);
}
