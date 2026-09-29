import { describe, expect, it } from "vitest";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import { buildMonthlyPdfReport } from "@/modules/reports/application/monthly-pdf-report";

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

describe("monthly PDF report", () => {
  it("exports a readable monthly summary PDF with safe metadata and exact minor-unit strings", () => {
    const result = buildMonthlyPdfReport({
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
    if (!result.ok) throw new Error("Expected monthly PDF report to build");

    const pdf = Buffer.from(result.value.pdf).toString("latin1");
    expect(result.value.filename).toBe("monthly-report-2026-03.pdf");
    expect(result.value.contentType).toBe("application/pdf");
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf).toContain("Monthly report 2026-03");
    expect(pdf).toContain("Period: 2026-03-01");
    expect(pdf).toContain("Currency: COP");
    expect(pdf).toContain("Time zone: America/Bogota");
    expect(pdf).toContain("income | totalMinor 520000 | completeness complete | plannedValuesUsed false");
    expect(pdf).toContain("totalCashOutflow | totalMinor 230000 | completeness partial | plannedValuesUsed true");
    expect(pdf).toContain("availableBalance | totalMinor 290000");
    expect(pdf).toContain("Groceries | EXPENSE | plannedMinor 200000");
    expect(pdf).toContain("2026-03-15 | Groceries | EXPENSE | OUTFLOW | actualMinor 80000 | Food");
    expect(pdf).not.toMatch(/userId|owner|ownerUserId|owner note|owner@example|cookie|credentials/i);
    expect(pdf).not.toContain("5200.00");
    expect(pdf).not.toContain("800.00");
  });

  it("escapes PDF syntax-sensitive and formula-like user text without changing exact minor-unit strings", () => {
    const result = buildMonthlyPdfReport({
      period,
      plannedBudgetLines: [
        plannedLine({ categoryName: "=SUM(1+1) \\ supplies", plannedAmountMinor: "12345" }),
      ],
      transactions: [
        transaction({ description: "Paid (cash) \\ receipt\nsecond line", amountMinor: "6789" }),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected escaped PDF report to build");

    const pdf = Buffer.from(result.value.pdf).toString("latin1");
    expect(pdf).toContain("=SUM\\(1+1\\) \\\\ supplies | EXPENSE | plannedMinor 12345");
    expect(pdf).toContain("actualMinor 6789 | Paid \\(cash\\) \\\\ receipt second line");
    expect(pdf).not.toContain("'12345");
    expect(pdf).not.toContain("'6789");
  });
});
