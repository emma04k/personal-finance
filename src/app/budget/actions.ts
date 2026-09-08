"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import { openMonthlyBudgetPeriod } from "@/modules/budget/application/monthly-planning-workflow";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { prisma } from "@/lib/prisma";

export async function createBudgetPeriodAction(formData: FormData): Promise<void> {
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

  if (!result.ok) return;

  revalidatePath("/budget");
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
