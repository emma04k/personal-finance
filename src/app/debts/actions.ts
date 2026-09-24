"use server";

import { revalidatePath } from "next/cache";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import {
  archiveDebtAccount,
  createDebtAccount,
  type DebtAccountArchiveError,
  type DebtAccountCreationError,
  type DebtAccountUpdateError,
  updateDebtAccount,
} from "@/modules/debt/application/debt-account-workflow";
import {
  recordDebtPayment,
  type DebtPaymentRecordError,
} from "@/modules/debt/application/debt-payment-workflow";
import { PrismaOwnedDebtAccountRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-account-repository";
import { PrismaOwnedDebtPaymentRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-payment-repository";
import { prisma } from "@/lib/prisma";
import type {
  DebtAccountActionField,
  DebtAccountActionState,
} from "./debt-account-action-state";
import type {
  DebtPaymentActionField,
  DebtPaymentActionState,
} from "./debt-payment-action-state";

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

export async function updateDebtAccountAction(
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
        message: "Sign in with an active account to update debt accounts.",
        fieldErrors: {},
      };
    }
    throw error;
  }

  const repository = new PrismaOwnedDebtAccountRepository(prisma);
  const debtAccountId = formData.get("debtAccountId");
  const result = await updateDebtAccount({
    owner,
    repository,
    input: {
      debtAccountId: typeof debtAccountId === "string" ? debtAccountId : "",
      name: stringField(formData, "name"),
      creditorName: optionalStringField(formData, "creditorName"),
      currentBalance: stringField(formData, "currentBalance"),
      defaultRequiredPayment: stringField(formData, "defaultRequiredPayment"),
      currencyCode: stringField(formData, "currencyCode"),
    },
  });

  if (!result.ok) return debtAccountErrorState(result.error, "update");

  revalidatePath("/debts");
  return {
    status: "success",
    message: "Debt account updated.",
    fieldErrors: {},
  };
}

export async function archiveDebtAccountAction(
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
        message: "Sign in with an active account to archive debt accounts.",
        fieldErrors: {},
      };
    }
    throw error;
  }

  const repository = new PrismaOwnedDebtAccountRepository(prisma);
  const debtAccountId = formData.get("debtAccountId");
  const result = await archiveDebtAccount({
    owner,
    repository,
    input: {
      debtAccountId: typeof debtAccountId === "string" ? debtAccountId : "",
    },
  });

  if (!result.ok) return debtAccountErrorState(result.error, "archive");

  revalidatePath("/debts");
  return {
    status: "success",
    message: "Debt account archived.",
    fieldErrors: {},
  };
}

export async function recordDebtPaymentAction(
  previousState: DebtPaymentActionState,
  formData: FormData,
): Promise<DebtPaymentActionState> {
  void previousState;

  let owner;
  try {
    owner = await requireCurrentOwnershipContext();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError || error instanceof UserNotActiveError) {
      return {
        status: "error",
        message: "Sign in with an active account to record debt payments.",
        fieldErrors: {},
      };
    }
    throw error;
  }

  const repository = new PrismaOwnedDebtPaymentRepository(prisma);
  const result = await recordDebtPayment({
    owner,
    repository,
    input: {
      debtAccountId: stringField(formData, "debtAccountId"),
      periodId: stringField(formData, "periodId"),
      amount: stringField(formData, "amount"),
      paidOn: stringField(formData, "paidOn"),
      requiredPaymentOverride: stringField(formData, "requiredPaymentOverride"),
      notes: optionalStringField(formData, "notes"),
    },
  });

  if (!result.ok) return debtPaymentErrorState(result.error);

  revalidatePath("/debts");
  return {
    status: "success",
    message: "Debt payment recorded.",
    fieldErrors: {},
  };
}

function debtAccountErrorState(
  error: DebtAccountCreationError | DebtAccountUpdateError | DebtAccountArchiveError,
  action: "update" | "archive" = "update",
): DebtAccountActionState {
  const actionVerb = action === "archive" ? "archive" : "update";
  switch (error.code) {
    case "DEBT_ACCOUNT_ID_REQUIRED":
      return debtAccountValidationError("debtAccountId", `Select a debt account to ${actionVerb}.`);
    case "INVALID_DEBT_ACCOUNT_ID":
      return debtAccountValidationError("debtAccountId", `Select a valid debt account to ${actionVerb}.`);
    case "DEBT_ACCOUNT_NOT_FOUND":
      return debtAccountValidationError("debtAccountId", "Debt account was not found for your active account.");
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

function debtPaymentErrorState(error: DebtPaymentRecordError): DebtPaymentActionState {
  switch (error.code) {
    case "DEBT_ACCOUNT_ID_REQUIRED":
      return debtPaymentValidationError("debtAccountId", "Select an active debt account.");
    case "INVALID_DEBT_ACCOUNT_ID":
      return debtPaymentValidationError("debtAccountId", "Select a valid active debt account.");
    case "DEBT_ACCOUNT_NOT_FOUND":
      return debtPaymentValidationError("debtAccountId", "Select an active debt account for your account.");
    case "PERIOD_ID_REQUIRED":
      return debtPaymentValidationError("periodId", "Select a monthly period.");
    case "INVALID_PERIOD_ID":
      return debtPaymentValidationError("periodId", "Select a valid monthly period.");
    case "PERIOD_NOT_FOUND":
      return debtPaymentValidationError("periodId", "Select a monthly period for your active account.");
    case "INVALID_PAYMENT_AMOUNT":
      return debtPaymentValidationError("amount", "Enter a valid payment amount for the selected debt account currency.");
    case "PAID_ON_REQUIRED":
      return debtPaymentValidationError("paidOn", "Enter a paid date.");
    case "INVALID_PAID_ON":
      return debtPaymentValidationError("paidOn", "Enter a valid paid date.");
    case "INVALID_REQUIRED_PAYMENT_OVERRIDE":
      return debtPaymentValidationError("requiredPaymentOverride", "Enter a valid required-payment override or leave it blank.");
    case "NOTES_TOO_LONG":
      return debtPaymentValidationError("notes", "Notes must be 500 characters or less.");
    case "DEBT_PAYMENT_ALREADY_RECORDED":
      return debtPaymentValidationError("periodId", "A payment for this account and monthly period is already recorded.");
    case "CURRENCY_MISMATCH":
      return debtPaymentValidationError("periodId", "Select a monthly period that uses the same currency as the debt account.");
  }
}

function debtPaymentValidationError(
  field: DebtPaymentActionField,
  message: string,
): DebtPaymentActionState {
  return {
    status: "error",
    message,
    fieldErrors: { [field]: message },
  };
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
