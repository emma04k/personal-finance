import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { buildMonthlyCsvReport } from "@/modules/reports/application/monthly-csv-report";
import { prisma } from "@/lib/prisma";

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<Response> {
  let owner;
  try {
    owner = await requireCurrentOwnershipContext();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return new Response("Authentication required", { status: 401 });
    }
    if (error instanceof UserNotActiveError) {
      return new Response("User is not active", { status: 403 });
    }
    throw error;
  }

  const periodId = new URL(request.url).searchParams.get("periodId");
  if (!periodId || !canonicalUuid.test(periodId)) {
    return new Response("Report period not found", { status: 404 });
  }

  const repository = new PrismaOwnedPlanningRepository(prisma);
  const period = await repository.findPeriodForOwner(owner.userId, periodId);
  if (!period) {
    return new Response("Report period not found", { status: 404 });
  }

  const [plannedBudgetLines, transactions] = await Promise.all([
    repository.listPlannedBudgetLinesForOwnerPeriod(owner.userId, period.id),
    repository.listTransactionsForOwnerPeriod(owner.userId, period.id),
  ]);
  const report = buildMonthlyCsvReport({ period, plannedBudgetLines, transactions });

  if (!report.ok) {
    return new Response("Report unavailable", { status: 422 });
  }

  return new Response(report.value.csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${report.value.filename}"`,
      "Content-Type": report.value.contentType,
    },
    status: 200,
  });
}
