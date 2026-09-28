import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import type {
  CreateDebtPaymentForOwnerInput,
  OwnedDebtPayment,
  OwnedDebtPaymentLinkedTransaction,
  OwnedDebtPaymentRepository,
} from "@/modules/debt/application/owned-debt-payment-repository";
import {
  DuplicateDebtPaymentError,
  DuplicateDebtPaymentTransactionLinkError,
} from "@/modules/debt/application/owned-debt-payment-repository";
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
    | "CURRENCY_MISMATCH"
    | "INVALID_TRANSACTION_ID"
    | "TRANSACTION_NOT_FOUND"
    | "TRANSACTION_PERIOD_MISMATCH"
    | "TRANSACTION_DIRECTION_INVALID"
    | "TRANSACTION_CURRENCY_MISMATCH"
    | "TRANSACTION_AMOUNT_MISMATCH"
    | "TRANSACTION_CATEGORY_NOT_COMPATIBLE"
    | "TRANSACTION_ALREADY_LINKED";
  field: "debtAccountId" | "periodId" | "amount" | "paidOn" | "requiredPaymentOverride" | "notes" | "linkedTransactionId";
}>;

export type DebtPaymentRecordError = DebtPaymentValidationError;

export type RecordDebtPaymentResult = Readonly<{ payment: OwnedDebtPayment }>;

export async function recordDebtPayment({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: Pick<
    OwnedDebtPaymentRepository,
    "findActiveDebtAccountForOwner" | "findPeriodForOwner" | "findDebtPaymentLinkTransactionForOwner" | "createDebtPaymentForOwner"
  >;
  readonly input: {
    readonly debtAccountId: string;
    readonly periodId: string;
    readonly linkedTransactionId?: string | null;
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

  const linkedTransactionIdResult = validateOptionalTransactionId(input.linkedTransactionId ?? null);
  if (!linkedTransactionIdResult.ok) return linkedTransactionIdResult;

  const account = await repository.findActiveDebtAccountForOwner(owner.userId, debtAccountIdResult.value);
  if (!account) return err({ code: "DEBT_ACCOUNT_NOT_FOUND", field: "debtAccountId" });

  const period = await repository.findPeriodForOwner(owner.userId, periodIdResult.value);
  if (!period) return err({ code: "PERIOD_NOT_FOUND", field: "periodId" });

  if (account.currencyCode !== period.currencyCode) {
    return err({ code: "CURRENCY_MISMATCH", field: "periodId" });
  }

  const amountMinor = parseCurrencyAmountToMinorUnits(input.amount, account.currencyCode);
  if (amountMinor === null) return err({ code: "INVALID_PAYMENT_AMOUNT", field: "amount" });

  const linkedTransactionId = linkedTransactionIdResult.value;
  if (linkedTransactionId) {
    const transaction = await repository.findDebtPaymentLinkTransactionForOwner(owner.userId, linkedTransactionId);
    const validation = validateLinkedTransaction({
      transaction,
      periodId: period.id,
      amountMinor,
      currencyCode: account.currencyCode,
    });
    if (!validation.ok) return validation;
  }

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
    linkedTransactionId,
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
    if (error instanceof DuplicateDebtPaymentTransactionLinkError) {
      return err({ code: "TRANSACTION_ALREADY_LINKED", field: "linkedTransactionId" });
    }
    throw error;
  }
  return ok({ payment });
}

function validateLinkedTransaction({
  transaction,
  periodId,
  amountMinor,
  currencyCode,
}: {
  readonly transaction: OwnedDebtPaymentLinkedTransaction | null;
  readonly periodId: string;
  readonly amountMinor: string;
  readonly currencyCode: string;
}): Result<true, DebtPaymentRecordError> {
  if (!transaction) return err({ code: "TRANSACTION_NOT_FOUND", field: "linkedTransactionId" });
  if (transaction.periodId !== periodId) {
    return err({ code: "TRANSACTION_PERIOD_MISMATCH", field: "linkedTransactionId" });
  }
  if (transaction.direction !== "OUTFLOW") {
    return err({ code: "TRANSACTION_DIRECTION_INVALID", field: "linkedTransactionId" });
  }
  if (transaction.currencyCode !== currencyCode) {
    return err({ code: "TRANSACTION_CURRENCY_MISMATCH", field: "linkedTransactionId" });
  }
  if (transaction.amountMinor !== amountMinor) {
    return err({ code: "TRANSACTION_AMOUNT_MISMATCH", field: "linkedTransactionId" });
  }
  if (transaction.categoryType !== null && transaction.categoryType !== "DEBT_PAYMENT") {
    return err({ code: "TRANSACTION_CATEGORY_NOT_COMPATIBLE", field: "linkedTransactionId" });
  }
  if (transaction.linkedDebtPaymentId !== null) {
    return err({ code: "TRANSACTION_ALREADY_LINKED", field: "linkedTransactionId" });
  }
  return ok(true);
}

function validateUuidField(
  input: string,
  field: "debtAccountId" | "periodId",
  requiredCode: "DEBT_ACCOUNT_ID_REQUIRED" | "PERIOD_ID_REQUIRED",
  invalidCode: "INVALID_DEBT_ACCOUNT_ID" | "INVALID_PERIOD_ID",
): Result<string, DebtPaymentRecordError> {
  const value = input.trim();
  if (value.length === 0) return err({ code: requiredCode, field });
  if (!isUuid(value)) return err({ code: invalidCode, field });
  return ok(value);
}

function validateOptionalTransactionId(input: string | null): Result<string | null, DebtPaymentRecordError> {
  const value = input?.trim() ?? "";
  if (value.length === 0) return ok(null);
  if (!isUuid(value)) return err({ code: "INVALID_TRANSACTION_ID", field: "linkedTransactionId" });
  return ok(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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
