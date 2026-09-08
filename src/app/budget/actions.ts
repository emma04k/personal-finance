"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import {
  openMonthlyBudgetPeriod,
  type MonthlyPlanningError,
} from "@/modules/budget/application/monthly-planning-workflow";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { prisma } from "@/lib/prisma";
import type {
  BudgetPeriodActionField,
  BudgetPeriodActionState,
} from "./budget-period-action-state";

export async function createBudgetPeriodAction(
  previousState: BudgetPeriodActionState,
  formData: FormData,
): Promise<BudgetPeriodActionState> {
  void previousState;

  const owner = await requireCurrentOwnershipContext();
  const repository = new PrismaOwnedPlanningRepository(prisma);
  const result = await openMonthlyBudgetPeriod({
    owner,
    repository,
    input: {
      monthStart: monthStartField(formData),
      currencyCode: stringField(formData, "currencyCode"),
      timeZone: stringField(formData, "timeZone"),
      note: optionalStringField(formData, "note"),
    },
  });

  if (!result.ok) return errorState(result.error);

  revalidatePath("/budget");
  return {
    status: "success",
    message: result.value.created ? "Periodo creado." : "Periodo abierto.",
    fieldErrors: {},
  };
}

function errorState(error: MonthlyPlanningError): BudgetPeriodActionState {
  switch (error.code) {
    case "INVALID_MONTH_START":
      return validationError("monthStart", "Usa un mes válido.");
    case "INVALID_CURRENCY_CODE":
      return validationError("currencyCode", "Usa un código de moneda de tres letras.");
    case "UNSUPPORTED_CURRENCY":
      return validationError("currencyCode", "Selecciona una moneda soportada.");
    case "INVALID_TIME_ZONE":
      return validationError("timeZone", "Usa una zona horaria válida.");
    case "NOTE_TOO_LONG":
      return validationError("note", "La nota debe tener máximo 500 caracteres.");
  }
}

function validationError(
  field: BudgetPeriodActionField,
  message: string,
): BudgetPeriodActionState {
  return {
    status: "error",
    message,
    fieldErrors: { [field]: message },
  };
}

function monthStartField(formData: FormData) {
  const value = stringField(formData, "monthStart");
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
}

function stringField(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function optionalStringField(formData: FormData, field: string) {
  const value = stringField(formData, field).trim();
  return value.length > 0 ? value : null;
}
