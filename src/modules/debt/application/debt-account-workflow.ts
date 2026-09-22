import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import type {
  CreateDebtAccountForOwnerInput,
  OwnedDebtAccount,
  OwnedDebtAccountRepository,
  UpdateDebtAccountForOwnerInput,
} from "@/modules/debt/application/owned-debt-account-repository";
import { parseCurrencyAmountToMinorUnits } from "@/modules/finance/application/currency-amount";
import { createCurrencyCode } from "@/modules/finance/domain/money";
import { err, ok, type Result } from "@/modules/finance/domain/result";

type DebtAccountValidationError = Readonly<{
  code:
    | "DEBT_ACCOUNT_ID_REQUIRED"
    | "INVALID_DEBT_ACCOUNT_ID"
    | "DEBT_ACCOUNT_NOT_FOUND"
    | "ACCOUNT_NAME_REQUIRED"
    | "ACCOUNT_NAME_TOO_LONG"
    | "CREDITOR_NAME_TOO_LONG"
    | "INVALID_CURRENCY_CODE"
    | "UNSUPPORTED_CURRENCY"
    | "INVALID_CURRENT_BALANCE"
    | "INVALID_REQUIRED_PAYMENT";
  field: "debtAccountId" | "name" | "creditorName" | "currencyCode" | "currentBalance" | "defaultRequiredPayment";
}>;

export type DebtAccountCreationError = DebtAccountValidationError;
export type DebtAccountUpdateError = DebtAccountValidationError;

export type CreateDebtAccountResult = Readonly<{
  account: OwnedDebtAccount;
}>;

export type UpdateDebtAccountResult = CreateDebtAccountResult;

export async function createDebtAccount({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: Pick<OwnedDebtAccountRepository, "createDebtAccountForOwner">;
  readonly input: {
    readonly name: string;
    readonly creditorName: string | null;
    readonly currentBalance: unknown;
    readonly defaultRequiredPayment: unknown;
    readonly currencyCode: string;
  };
}): Promise<Result<CreateDebtAccountResult, DebtAccountCreationError>> {
  const validatedInput = validateDebtAccountInput(input);
  if (!validatedInput.ok) return validatedInput;

  const createInput: CreateDebtAccountForOwnerInput = validatedInput.value;
  const account = await repository.createDebtAccountForOwner(owner.userId, createInput);
  return ok({ account });
}

export async function updateDebtAccount({
  input,
  owner,
  repository,
}: {
  readonly owner: OwnershipContext;
  readonly repository: Pick<OwnedDebtAccountRepository, "updateDebtAccountForOwner">;
  readonly input: {
    readonly debtAccountId: string;
    readonly name: string;
    readonly creditorName: string | null;
    readonly currentBalance: unknown;
    readonly defaultRequiredPayment: unknown;
    readonly currencyCode: string;
  };
}): Promise<Result<UpdateDebtAccountResult, DebtAccountUpdateError>> {
  const debtAccountId = input.debtAccountId.trim();
  if (debtAccountId.length === 0) return err({ code: "DEBT_ACCOUNT_ID_REQUIRED", field: "debtAccountId" });
  if (!isUuid(debtAccountId)) return err({ code: "INVALID_DEBT_ACCOUNT_ID", field: "debtAccountId" });

  const validatedInput = validateDebtAccountInput(input);
  if (!validatedInput.ok) return validatedInput;

  const updateInput: UpdateDebtAccountForOwnerInput = validatedInput.value;
  const account = await repository.updateDebtAccountForOwner(owner.userId, debtAccountId, updateInput);
  if (!account) return err({ code: "DEBT_ACCOUNT_NOT_FOUND", field: "debtAccountId" });

  return ok({ account });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function validateDebtAccountInput(input: {
  readonly name: string;
  readonly creditorName: string | null;
  readonly currentBalance: unknown;
  readonly defaultRequiredPayment: unknown;
  readonly currencyCode: string;
}): Result<CreateDebtAccountForOwnerInput, DebtAccountValidationError> {
  const name = input.name.trim();
  if (name.length === 0) return err({ code: "ACCOUNT_NAME_REQUIRED", field: "name" });
  if (name.length > 120) return err({ code: "ACCOUNT_NAME_TOO_LONG", field: "name" });

  const creditorName = input.creditorName?.trim() ?? null;
  const normalizedCreditorName = creditorName && creditorName.length > 0 ? creditorName : null;
  if (normalizedCreditorName && normalizedCreditorName.length > 120) {
    return err({ code: "CREDITOR_NAME_TOO_LONG", field: "creditorName" });
  }

  const currency = createCurrencyCode(input.currencyCode);
  if (!currency.ok) return err({ code: currency.error.code, field: "currencyCode" });

  const currentBalanceMinor = parseCurrencyAmountToMinorUnits(input.currentBalance, currency.value);
  if (currentBalanceMinor === null) {
    return err({ code: "INVALID_CURRENT_BALANCE", field: "currentBalance" });
  }

  const defaultRequiredPaymentMinor = parseCurrencyAmountToMinorUnits(
    input.defaultRequiredPayment,
    currency.value,
  );
  if (defaultRequiredPaymentMinor === null) {
    return err({ code: "INVALID_REQUIRED_PAYMENT", field: "defaultRequiredPayment" });
  }

  return ok({
    name,
    creditorName: normalizedCreditorName,
    currentBalanceMinor,
    defaultRequiredPaymentMinor,
    currencyCode: currency.value,
  });
}
