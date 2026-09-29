import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnershipContext } from "@/modules/auth/application/ownership-context";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";

const mocks = vi.hoisted(() => {
  const owner: OwnershipContext = {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "OWNER",
    email: "owner@example.test",
  };
  const period = {
    id: "10000000-0000-0000-0000-000000000001",
    userId: owner.userId,
    monthStart: "2026-03-01",
    currencyCode: "COP",
    timeZone: "America/Bogota",
    note: null,
  };
  const findPeriodForOwner = vi.fn(async (): Promise<typeof period | null> => period);
  const listPlannedBudgetLinesForOwnerPeriod = vi.fn(async () => [{
    id: "30000000-0000-0000-0000-000000000001",
    userId: owner.userId,
    periodId: period.id,
    categoryId: "salary",
    categoryName: "Salary",
    categoryType: "INCOME" as const,
    plannedAmountMinor: "500000",
    currencyCode: "COP",
  }]);
  const listTransactionsForOwnerPeriod = vi.fn(async () => [{
    id: "40000000-0000-0000-0000-000000000001",
    userId: owner.userId,
    periodId: period.id,
    categoryId: "salary",
    categoryName: "Salary",
    categoryType: "INCOME" as const,
    direction: "INFLOW" as const,
    amountMinor: "520000",
    currencyCode: "COP",
    occurredOn: "2026-03-15",
    description: "Payroll",
  }]);
  const repository = {
    findPeriodForOwner,
    listPlannedBudgetLinesForOwnerPeriod,
    listTransactionsForOwnerPeriod,
  };

  return {
    owner,
    period,
    repository,
    findPeriodForOwner,
    listPlannedBudgetLinesForOwnerPeriod,
    listTransactionsForOwnerPeriod,
    requireCurrentOwnershipContext: vi.fn(async () => owner),
  };
});

vi.mock("@/modules/auth/application/current-ownership-context", () => ({
  requireCurrentOwnershipContext: mocks.requireCurrentOwnershipContext,
}));

vi.mock("@/modules/budget/infrastructure/prisma-owned-planning-repository", () => ({
  PrismaOwnedPlanningRepository: vi.fn(function PrismaOwnedPlanningRepository() {
    return mocks.repository;
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { GET } from "@/app/reports/export/xlsx/route";

function exportRequest(periodId = mocks.period.id) {
  return new Request(`http://localhost/reports/export/xlsx?periodId=${periodId}`);
}

function exportRequestWithoutPeriod() {
  return new Request("http://localhost/reports/export/xlsx");
}

async function readWorksheet(response: Response, path: string) {
  const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
  const file = zip.file(path);
  if (!file) throw new Error(`Missing workbook file ${path}`);
  return file.async("string");
}

describe("reports XLSX export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findPeriodForOwner.mockResolvedValue(mocks.period);
    mocks.listPlannedBudgetLinesForOwnerPeriod.mockResolvedValue([{
      id: "30000000-0000-0000-0000-000000000001",
      userId: mocks.owner.userId,
      periodId: mocks.period.id,
      categoryId: "salary",
      categoryName: "Salary",
      categoryType: "INCOME" as const,
      plannedAmountMinor: "500000",
      currencyCode: "COP",
    }]);
    mocks.listTransactionsForOwnerPeriod.mockResolvedValue([{
      id: "40000000-0000-0000-0000-000000000001",
      userId: mocks.owner.userId,
      periodId: mocks.period.id,
      categoryId: "salary",
      categoryName: "Salary",
      categoryType: "INCOME" as const,
      direction: "INFLOW" as const,
      amountMinor: "520000",
      currencyCode: "COP",
      occurredOn: "2026-03-15",
      description: "Payroll",
    }]);
    mocks.requireCurrentOwnershipContext.mockResolvedValue(mocks.owner);
  });

  it("returns an attachment XLSX for the authenticated owner period", async () => {
    const response = await GET(exportRequest());
    const summary = await readWorksheet(response.clone(), "xl/worksheets/sheet2.xml");
    const actual = await readWorksheet(response, "xl/worksheets/sheet4.xml");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="monthly-report-2026-03.xlsx"');
    expect(mocks.findPeriodForOwner).toHaveBeenCalledWith(mocks.owner.userId, mocks.period.id);
    expect(mocks.listPlannedBudgetLinesForOwnerPeriod).toHaveBeenCalledWith(mocks.owner.userId, mocks.period.id);
    expect(mocks.listTransactionsForOwnerPeriod).toHaveBeenCalledWith(mocks.owner.userId, mocks.period.id);
    expect(summary).toContain("<t>520000</t>");
    expect(actual).toContain("<t>Payroll</t>");
    expect(`${summary}\n${actual}`).not.toMatch(/userId|ownerUserId|owner@example|cookie|credential/i);
  });

  it("fails closed before querying owner data when no active authenticated user exists", async () => {
    mocks.requireCurrentOwnershipContext.mockRejectedValueOnce(new AuthenticationRequiredError());

    const response = await GET(exportRequest());

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Authentication required");
    expect(mocks.findPeriodForOwner).not.toHaveBeenCalled();
    expect(mocks.listPlannedBudgetLinesForOwnerPeriod).not.toHaveBeenCalled();
    expect(mocks.listTransactionsForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("denies inactive users before querying owner data", async () => {
    mocks.requireCurrentOwnershipContext.mockRejectedValueOnce(new UserNotActiveError());

    const response = await GET(exportRequest());

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("User is not active");
    expect(mocks.findPeriodForOwner).not.toHaveBeenCalled();
  });

  it("returns not found for a cross-owner period without exporting rows", async () => {
    mocks.findPeriodForOwner.mockResolvedValueOnce(null);

    const response = await GET(exportRequest("10000000-0000-0000-0000-000000000999"));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Report period not found");
    expect(mocks.findPeriodForOwner).toHaveBeenCalledWith(
      mocks.owner.userId,
      "10000000-0000-0000-0000-000000000999",
    );
    expect(mocks.listPlannedBudgetLinesForOwnerPeriod).not.toHaveBeenCalled();
    expect(mocks.listTransactionsForOwnerPeriod).not.toHaveBeenCalled();
  });

  it("rejects missing and malformed period identifiers before persistence access", async () => {
    const missingPeriod = await GET(exportRequestWithoutPeriod());
    const malformedPeriod = await GET(exportRequest("not-a-uuid"));

    expect(missingPeriod.status).toBe(404);
    expect(await missingPeriod.text()).toBe("Report period not found");
    expect(malformedPeriod.status).toBe(404);
    expect(await malformedPeriod.text()).toBe("Report period not found");
    expect(mocks.findPeriodForOwner).not.toHaveBeenCalled();
    expect(mocks.listPlannedBudgetLinesForOwnerPeriod).not.toHaveBeenCalled();
    expect(mocks.listTransactionsForOwnerPeriod).not.toHaveBeenCalled();
  });
});