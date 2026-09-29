import { describe, expect, it } from "vitest";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import { buildMonthlyCsvReport } from "@/modules/reports/application/monthly-csv-report";

const ownerId = "00000000-0000-0000-0000-000000000001";
const period: OwnedPeriod = {
  id: "10000000-0000-0000-0000-000000000001",
  userId: ownerId,
  monthStart: "2026-03-01",
  currencyCode: "COP",
  timeZone: "America/Bogota",
  note: "Owner note",
};

function plannedLine(overrides: Partial<OwnedBudgetLine>): OwnedBudgetLine {
  return {
    id: overrides.id ?? `line-${overrides.categoryId ?? "category"}`,
    userId: overrides.userId ?? ownerId,
    periodId: overrides.periodId ?? period.id,
    categoryId: overrides.categoryId ?? "category",
    categoryName: overrides.categoryName ?? "Category",
    categoryType: overrides.categoryType ?? "EXPENSE",
    plannedAmountMinor: overrides.plannedAmountMinor ?? "0",
    currencyCode: overrides.currencyCode ?? period.currencyCode,
  };
}

function transaction(overrides: Partial<OwnedTransaction>): OwnedTransaction {
  return {
    id: overrides.id ?? `tx-${overrides.categoryId ?? "category"}`,
    userId: overrides.userId ?? ownerId,
    periodId: overrides.periodId ?? period.id,
    categoryId: overrides.categoryId ?? "category",
    categoryName: overrides.categoryName ?? "Category",
    categoryType: overrides.categoryType ?? "EXPENSE",
    direction: overrides.direction ?? "OUTFLOW",
    amountMinor: overrides.amountMinor ?? "0",
    currencyCode: overrides.currencyCode ?? period.currencyCode,
    occurredOn: overrides.occurredOn ?? "2026-03-15",
    description: overrides.description ?? "Synthetic movement",
  };
}

describe("monthly CSV report", () => {
  it("exports safe period metadata, deterministic summary totals, planned lines, and transactions as minor-unit strings", () => {
    const result = buildMonthlyCsvReport({
      period,
      plannedBudgetLines: [
        plannedLine({ categoryId: "salary", categoryName: "Salary", categoryType: "INCOME", plannedAmountMinor: "500000" }),
        plannedLine({ categoryId: "groceries", categoryName: "Groceries", categoryType: "EXPENSE", plannedAmountMinor: "200000" }),
        plannedLine({ categoryId: "reserve", categoryName: "Reserve", categoryType: "SAVINGS", plannedAmountMinor: "150000" }),
      ],
      transactions: [
        transaction({ categoryId: "salary", categoryName: "Salary", categoryType: "INCOME", direction: "INFLOW", amountMinor: "520000" }),
        transaction({ categoryId: "groceries", categoryName: "Groceries", categoryType: "EXPENSE", amountMinor: "80000", description: "Food" }),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected monthly CSV report to build");

    expect(result.value.filename).toBe("monthly-report-2026-03.csv");
    expect(result.value.contentType).toBe("text/csv; charset=utf-8");
    expect(result.value.csv).toContain("section,rowType,monthStart,currencyCode,timeZone,name,categoryType,direction,occurredOn,description,plannedAmountMinor,actualAmountMinor,totalMinor,completeness,plannedValuesUsed,detail\n");
    expect(result.value.csv).toContain("metadata,period,2026-03-01,COP,America/Bogota,,,,,,,,,,,\n");
    expect(result.value.csv).toContain("summary,income,2026-03-01,COP,,,,,,,,,520000,complete,false,\n");
    expect(result.value.csv).toContain("summary,totalCashOutflow,2026-03-01,COP,,,,,,,,,230000,partial,true,\n");
    expect(result.value.csv).toContain("summary,availableBalance,2026-03-01,COP,,,,,,,,,290000,,,\n");
    expect(result.value.csv).toContain("planned_budget_line,budgetLine,2026-03-01,COP,,Groceries,EXPENSE,,,,200000,,,,,\n");
    expect(result.value.csv).toContain("actual_transaction,transaction,2026-03-01,COP,,Groceries,EXPENSE,OUTFLOW,2026-03-15,Food,,80000,,,,\n");
    expect(result.value.csv).not.toMatch(/userId|owner|ownerUserId|cookie|credentials/i);
    expect(result.value.csv).not.toMatch(/\.\d/);
  });

  it("escapes commas, quotes, and newlines in CSV values", () => {
    const result = buildMonthlyCsvReport({
      period: { ...period, note: null },
      plannedBudgetLines: [
        plannedLine({ categoryName: "Food, \"market\"\nweekly", plannedAmountMinor: "12345" }),
      ],
      transactions: [
        transaction({ description: "Paid, \"cash\"\nwith coupon", amountMinor: "6789" }),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected escaped CSV report to build");

    expect(result.value.csv).toContain('"Food, ""market""\nweekly"');
    expect(result.value.csv).toContain('"Paid, ""cash""\nwith coupon"');
  });

  it("neutralizes spreadsheet formula prefixes in user-controlled text without changing minor-unit numbers", () => {
    const result = buildMonthlyCsvReport({
      period,
      plannedBudgetLines: [
        plannedLine({ categoryName: "=SUM(A1:A2)", plannedAmountMinor: "12345" }),
      ],
      transactions: [
        transaction({ description: "+cmd|calc", amountMinor: "6789" }),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected formula-safe CSV report to build");

    expect(result.value.csv).toContain("planned_budget_line,budgetLine,2026-03-01,COP,,'=SUM(A1:A2),EXPENSE,,,,12345,,,,,");
    expect(result.value.csv).toContain("actual_transaction,transaction,2026-03-01,COP,,Category,EXPENSE,OUTFLOW,2026-03-15,'+cmd|calc,,6789,,,,");
    expect(result.value.csv).not.toContain("'12345");
    expect(result.value.csv).not.toContain("'6789");
  });
});
