import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import { parseCurrencyAmountToMinorUnits } from "@/modules/finance/application/currency-amount";
import { createCurrencyCode, type CurrencyCodeError } from "@/modules/finance/domain/money";
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
    | "DESCRIPTION_TOO_LONG";
  field: "amount" | "periodId" | "categoryId" | "currencyCode" | "occurredOn" | "description";
}>;

export type PeriodTransactionError = PeriodTransactionValidationError | CurrencyCodeError;

export type CreatePeriodTransactionResult = Readonly<{
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

  const period = await repository.findPeriodForOwner(owner.userId, input.periodId);
  if (!period) return err({ code: "PERIOD_NOT_FOUND", field: "periodId" });

  if (period.currencyCode !== currency.value) {
    return err({ code: "CURRENCY_MISMATCH", field: "currencyCode" });
  }

  if (!isCanonicalDate(input.occurredOn)) {
    return err({ code: "INVALID_OCCURRED_ON", field: "occurredOn" });
  }
  if (!isDateInsidePeriodMonth(input.occurredOn, period.monthStart)) {
    return err({ code: "DATE_OUTSIDE_PERIOD", field: "occurredOn" });
  }

  const category = await repository.findCategoryForOwner(owner.userId, input.categoryId);
  if (!category) return err({ code: "CATEGORY_NOT_FOUND", field: "categoryId" });
  if (category.archivedAt !== null) {
    return err({ code: "CATEGORY_NOT_ACTIVE", field: "categoryId" });
  }
  if (!allowedCategoryTypes.has(category.type)) {
    return err({ code: "INVALID_CATEGORY_TYPE", field: "categoryId" });
  }

  const transaction = await repository.createTransactionForOwner(owner.userId, {
    periodId: period.id,
    categoryId: category.id,
    direction: category.type === "INCOME" ? "INFLOW" : "OUTFLOW",
    amountMinor,
    currencyCode: currency.value,
    occurredOn: input.occurredOn,
    description,
  });
  return ok({ transaction });
}

function isCanonicalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isDateInsidePeriodMonth(occurredOn: string, monthStart: string) {
  return occurredOn.slice(0, 7) === monthStart.slice(0, 7);
}
