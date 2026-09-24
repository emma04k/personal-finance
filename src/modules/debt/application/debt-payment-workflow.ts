import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import type {
  CreateDebtPaymentForOwnerInput,
  OwnedDebtPayment,
  OwnedDebtPaymentRepository,
} from "@/modules/debt/application/owned-debt-payment-repository";
import { DuplicateDebtPaymentError } from "@/modules/debt/application/owned-debt-payment-repository";
import { parseCurrencyAmountToMinorUnits } from "@/modules/finance/application/currency-amount";
import { err, ok, type Result } from "@/modules/finance/domain/result";

type DebtPaymentValidationError = Readonly<{
  code:
    | "DEBT_ACCOUNT_ID_REQUIRED"
    | "INVALID_DEBT_ACCOUNT_ID"
    | "DEBT_ACCOUNT_NOT_FOUND"
    | "PERIOD_ID_REQUIRED"
    | "INVALID_PERIOD_ID"
    | "PERIOD_NOT_FOUND"
    | "INVALID_PAYMENT_AMOUNT"
    | "PAID_ON_REQUIRED"
    | "INVALID_PAID_ON"
    | "INVALID_REQUIRED_PAYMENT_OVERRIDE"
    | "NOTES_TOO_LONG"
    | "DEBT_PAYMENT_ALREADY_RECORDED"
    | "CURRENCY_MISMATCH";
  field: "debtAccountId" | "periodId" | "amount" | "paidOn" | "requiredPaymentOverride" | "notes";
}>;

export type DebtPaymentRecordError = DebtPaymentValidationError;

export type RecordDebtPaymentResult = Readonly<{ payment: OwnedDebtPayment }>;

export async function recordDebtPayment({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: OwnedDebtPaymentRepository;
  readonly input: {
    readonly debtAccountId: string;
    readonly periodId: string;
    readonly amount: unknown;
    readonly paidOn: string;
    readonly requiredPaymentOverride: unknown;
    readonly notes: string | null;
  };
}): Promise<Result<RecordDebtPaymentResult, DebtPaymentRecordError>> {
  const debtAccountIdResult = validateUuidField(
    input.debtAccountId,
    "debtAccountId",
    "DEBT_ACCOUNT_ID_REQUIRED",
    "INVALID_DEBT_ACCOUNT_ID",
  );
  if (!debtAccountIdResult.ok) return debtAccountIdResult;

  const periodIdResult = validateUuidField(
    input.periodId,
    "periodId",
    "PERIOD_ID_REQUIRED",
    "INVALID_PERIOD_ID",
  );
  if (!periodIdResult.ok) return periodIdResult;

  const account = await repository.findActiveDebtAccountForOwner(owner.userId, debtAccountIdResult.value);
  if (!account) return err({ code: "DEBT_ACCOUNT_NOT_FOUND", field: "debtAccountId" });

  const period = await repository.findPeriodForOwner(owner.userId, periodIdResult.value);
  if (!period) return err({ code: "PERIOD_NOT_FOUND", field: "periodId" });

  if (account.currencyCode !== period.currencyCode) {
    return err({ code: "CURRENCY_MISMATCH", field: "periodId" });
  }

  const amountMinor = parseCurrencyAmountToMinorUnits(input.amount, account.currencyCode);
  if (amountMinor === null) return err({ code: "INVALID_PAYMENT_AMOUNT", field: "amount" });

  const paidOn = input.paidOn.trim();
  if (paidOn.length === 0) return err({ code: "PAID_ON_REQUIRED", field: "paidOn" });
  if (!isDateOnly(paidOn)) return err({ code: "INVALID_PAID_ON", field: "paidOn" });

  const requiredPaymentOverrideMinor = parseOptionalCurrencyAmount(
    input.requiredPaymentOverride,
    account.currencyCode,
  );
  if (requiredPaymentOverrideMinor === undefined) {
    return err({ code: "INVALID_REQUIRED_PAYMENT_OVERRIDE", field: "requiredPaymentOverride" });
  }

  const notes = input.notes?.trim() ?? null;
  const normalizedNotes = notes && notes.length > 0 ? notes : null;
  if (normalizedNotes && normalizedNotes.length > 500) return err({ code: "NOTES_TOO_LONG", field: "notes" });

  const createInput: CreateDebtPaymentForOwnerInput = {
    debtAccountId: account.id,
    periodId: period.id,
    amountMinor,
    currencyCode: account.currencyCode,
    paidOn,
    requiredPaymentOverrideMinor,
    notes: normalizedNotes,
  };
  let payment;
  try {
    payment = await repository.createDebtPaymentForOwner(owner.userId, createInput);
  } catch (error) {
    if (error instanceof DuplicateDebtPaymentError) {
      return err({ code: "DEBT_PAYMENT_ALREADY_RECORDED", field: "periodId" });
    }
    throw error;
  }
  return ok({ payment });
}

function validateUuidField(
  input: string,
  field: "debtAccountId" | "periodId",
  requiredCode: "DEBT_ACCOUNT_ID_REQUIRED" | "PERIOD_ID_REQUIRED",
  invalidCode: "INVALID_DEBT_ACCOUNT_ID" | "INVALID_PERIOD_ID",
): Result<string, DebtPaymentRecordError> {
  const value = input.trim();
  if (value.length === 0) return err({ code: requiredCode, field });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return err({ code: invalidCode, field });
  }
  return ok(value);
}

function parseOptionalCurrencyAmount(input: unknown, currencyCode: string) {
  if (typeof input !== "string" || input.trim().length === 0) return null;
  const parsed = parseCurrencyAmountToMinorUnits(input, currencyCode);
  return parsed ?? undefined;
}

function isDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}
