"use server";

import { revalidatePath } from "next/cache";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import {
  createDebtAccount,
  type DebtAccountCreationError,
} from "@/modules/debt/application/debt-account-workflow";
import { PrismaOwnedDebtAccountRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-account-repository";
import { prisma } from "@/lib/prisma";
import type {
  DebtAccountActionField,
  DebtAccountActionState,
} from "./debt-account-action-state";

export async function createDebtAccountAction(
  previousState: DebtAccountActionState,
  formData: FormData,
): Promise<DebtAccountActionState> {
  void previousState;

  let owner;
  try {
    owner = await requireCurrentOwnershipContext();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof UserNotActiveError) {
      return {
        status: "error",
        message: "Sign in with an active account to create debt accounts.",
        fieldErrors: {},
      };
    }
    throw error;
  }

  const repository = new PrismaOwnedDebtAccountRepository(prisma);
  const result = await createDebtAccount({
    owner,
    repository,
    input: {
      name: stringField(formData, "name"),
      creditorName: optionalStringField(formData, "creditorName"),
      currentBalance: stringField(formData, "currentBalance"),
      defaultRequiredPayment: stringField(formData, "defaultRequiredPayment"),
      currencyCode: stringField(formData, "currencyCode"),
    },
  });

  if (!result.ok) return debtAccountErrorState(result.error);

  revalidatePath("/debts");
  return {
    status: "success",
    message: "Debt account created.",
    fieldErrors: {},
  };
}

function debtAccountErrorState(error: DebtAccountCreationError): DebtAccountActionState {
  switch (error.code) {
    case "ACCOUNT_NAME_REQUIRED":
      return debtAccountValidationError("name", "Enter an account name.");
    case "ACCOUNT_NAME_TOO_LONG":
      return debtAccountValidationError("name", "Account name must be 120 characters or less.");
    case "CREDITOR_NAME_TOO_LONG":
      return debtAccountValidationError("creditorName", "Creditor name must be 120 characters or less.");
    case "INVALID_CURRENCY_CODE":
      return debtAccountValidationError("currencyCode", "Use a three-letter currency code.");
    case "UNSUPPORTED_CURRENCY":
      return debtAccountValidationError("currencyCode", "Select a supported currency.");
    case "INVALID_CURRENT_BALANCE":
      return debtAccountValidationError("currentBalance", "Enter a valid current balance for the selected currency.");
    case "INVALID_REQUIRED_PAYMENT":
      return debtAccountValidationError("defaultRequiredPayment", "Enter a valid required monthly payment for the selected currency.");
  }
}

function debtAccountValidationError(
  field: DebtAccountActionField,
  message: string,
): DebtAccountActionState {
  return {
    status: "error",
    message,
    fieldErrors: { [field]: message },
  };
}

function stringField(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function optionalStringField(formData: FormData, field: string) {
  const value = stringField(formData, field).trim();
  return value.length > 0 ? value : null;
}
