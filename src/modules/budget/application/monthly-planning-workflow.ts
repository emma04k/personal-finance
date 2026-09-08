import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import { createCurrencyCode, type CurrencyCodeError } from "@/modules/finance/domain/money";
import { err, ok, type Result } from "@/modules/finance/domain/result";
import type {
  CreatePeriodForOwnerInput,
  OwnedPeriod,
  OwnedPlanningRepository,
} from "./owned-planning-repository";

type MonthlyPlanningValidationError = Readonly<{
  code: "INVALID_MONTH_START" | "INVALID_TIME_ZONE" | "NOTE_TOO_LONG";
  field: "monthStart" | "timeZone" | "note";
}>;

export type MonthlyPlanningError = MonthlyPlanningValidationError | CurrencyCodeError;

export type OpenMonthlyBudgetPeriodResult = Readonly<{
  period: OwnedPeriod;
  created: boolean;
}>;

export async function openMonthlyBudgetPeriod({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: Pick<
    OwnedPlanningRepository,
    "findPeriodByMonthForOwner" | "createPeriodForOwner"
  >;
  readonly input: CreatePeriodForOwnerInput;
}): Promise<Result<OpenMonthlyBudgetPeriodResult, MonthlyPlanningError>> {
  const monthStart = validateMonthStart(input.monthStart);
  if (!monthStart.ok) return monthStart;

  const currency = createCurrencyCode(input.currencyCode);
  if (!currency.ok) return currency;

  if (!isValidTimeZone(input.timeZone)) {
    return err({ code: "INVALID_TIME_ZONE", field: "timeZone" });
  }

  if (input.note !== null && input.note !== undefined && input.note.length > 500) {
    return err({ code: "NOTE_TOO_LONG", field: "note" });
  }

  const existingPeriod = await repository.findPeriodByMonthForOwner(
    owner.userId,
    monthStart.value,
  );
  if (existingPeriod) return ok({ period: existingPeriod, created: false });

  const period = await repository.createPeriodForOwner(owner.userId, {
    monthStart: monthStart.value,
    currencyCode: currency.value,
    timeZone: input.timeZone,
    note: input.note ?? null,
  });
  return ok({ period, created: true });
}

function validateMonthStart(input: string): Result<string, MonthlyPlanningValidationError> {
  if (!/^\d{4}-\d{2}-01$/.test(input)) {
    return err({ code: "INVALID_MONTH_START", field: "monthStart" });
  }

  const parsed = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== input) {
    return err({ code: "INVALID_MONTH_START", field: "monthStart" });
  }

  return ok(input);
}

function isValidTimeZone(input: string) {
  if (typeof input !== "string" || input.length === 0 || input.length > 64) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input }).format(new Date("2026-01-01"));
    return true;
  } catch {
    return false;
  }
}
