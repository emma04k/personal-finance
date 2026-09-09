"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import {
  createBudgetCategory,
  type BudgetCategoryError,
} from "@/modules/budget/application/budget-category-workflow";
import {
  openMonthlyBudgetPeriod,
  type MonthlyPlanningError,
} from "@/modules/budget/application/monthly-planning-workflow";
import {
  type PlannedBudgetLineError,
  upsertPlannedBudgetLine,
} from "@/modules/budget/application/planned-budget-line-workflow";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { prisma } from "@/lib/prisma";
import type {
  BudgetCategoryActionField,
  BudgetCategoryActionState,
} from "./budget-category-action-state";
import type {
  BudgetPeriodActionField,
  BudgetPeriodActionState,
} from "./budget-period-action-state";
import type {
  BudgetLineActionField,
  BudgetLineActionState,
} from "./budget-line-action-state";

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

  if (!result.ok) return periodErrorState(result.error);

  revalidatePath("/budget");
  return {
    status: "success",
    message: result.value.created ? "Periodo creado." : "Periodo abierto.",
    fieldErrors: {},
  };
}

export async function createBudgetCategoryAction(
  previousState: BudgetCategoryActionState,
  formData: FormData,
): Promise<BudgetCategoryActionState> {
  void previousState;

  const owner = await requireCurrentOwnershipContext();
  const repository = new PrismaOwnedPlanningRepository(prisma);
  const result = await createBudgetCategory({
    owner,
    repository,
    input: {
      type: stringField(formData, "type"),
      name: stringField(formData, "name"),
    },
  });

  if (!result.ok) return categoryErrorState(result.error);

  revalidatePath("/budget");
  return {
    status: "success",
    message: "Categoría creada.",
    fieldErrors: {},
  };
}

export async function createBudgetLineAction(
  previousState: BudgetLineActionState,
  formData: FormData,
): Promise<BudgetLineActionState> {
  void previousState;

  const owner = await requireCurrentOwnershipContext();
  const repository = new PrismaOwnedPlanningRepository(prisma);
  const result = await upsertPlannedBudgetLine({
    owner,
    repository,
    input: {
      periodId: stringField(formData, "periodId"),
      categoryId: stringField(formData, "categoryId"),
      plannedAmount: stringField(formData, "plannedAmount"),
      currencyCode: stringField(formData, "currencyCode"),
    },
  });

  if (!result.ok) return budgetLineErrorState(result.error);

  revalidatePath("/budget");
  return {
    status: "success",
    message: "Monto planeado guardado.",
    fieldErrors: {},
  };
}

function periodErrorState(error: MonthlyPlanningError): BudgetPeriodActionState {
  switch (error.code) {
    case "INVALID_MONTH_START":
      return periodValidationError("monthStart", "Usa un mes válido.");
    case "INVALID_CURRENCY_CODE":
      return periodValidationError("currencyCode", "Usa un código de moneda de tres letras.");
    case "UNSUPPORTED_CURRENCY":
      return periodValidationError("currencyCode", "Selecciona una moneda soportada.");
    case "INVALID_TIME_ZONE":
      return periodValidationError("timeZone", "Usa una zona horaria válida.");
    case "NOTE_TOO_LONG":
      return periodValidationError("note", "La nota debe tener máximo 500 caracteres.");
  }
}

function periodValidationError(
  field: BudgetPeriodActionField,
  message: string,
): BudgetPeriodActionState {
  return {
    status: "error",
    message,
    fieldErrors: { [field]: message },
  };
}

function categoryErrorState(error: BudgetCategoryError): BudgetCategoryActionState {
  switch (error.code) {
    case "INVALID_CATEGORY_TYPE":
      return categoryValidationError("type", "Selecciona un tipo de categoría válido.");
    case "CATEGORY_NAME_REQUIRED":
      return categoryValidationError("name", "Escribe un nombre para la categoría.");
    case "CATEGORY_NAME_TOO_LONG":
      return categoryValidationError("name", "El nombre debe tener máximo 120 caracteres.");
    case "DUPLICATE_CATEGORY":
      return categoryValidationError("name", "Ya existe una categoría con ese tipo y nombre.");
  }
}

function categoryValidationError(
  field: BudgetCategoryActionField,
  message: string,
): BudgetCategoryActionState {
  return {
    status: "error",
    message,
    fieldErrors: { [field]: message },
  };
}

function budgetLineErrorState(error: PlannedBudgetLineError): BudgetLineActionState {
  switch (error.code) {
    case "INVALID_PLANNED_AMOUNT":
      return budgetLineValidationError("plannedAmount", "Usa un monto válido con los decimales permitidos para la moneda.");
    case "PERIOD_NOT_FOUND":
      return budgetLineValidationError("periodId", "Selecciona un periodo propio válido.");
    case "CATEGORY_NOT_FOUND":
      return budgetLineValidationError("categoryId", "Selecciona una categoría propia válida.");
    case "CATEGORY_NOT_ACTIVE":
      return budgetLineValidationError("categoryId", "Selecciona una categoría activa.");
    case "INVALID_CATEGORY_TYPE":
      return budgetLineValidationError("categoryId", "Selecciona un tipo de categoría válido.");
    case "INVALID_CURRENCY_CODE":
      return budgetLineValidationError("currencyCode", "Usa un código de moneda de tres letras.");
    case "UNSUPPORTED_CURRENCY":
      return budgetLineValidationError("currencyCode", "Selecciona una moneda soportada.");
    case "CURRENCY_MISMATCH":
      return budgetLineValidationError("currencyCode", "Usa la misma moneda del periodo seleccionado.");
  }
}

function budgetLineValidationError(
  field: BudgetLineActionField,
  message: string,
): BudgetLineActionState {
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
