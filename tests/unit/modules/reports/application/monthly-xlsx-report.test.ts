import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import { buildMonthlyXlsxReport } from "@/modules/reports/application/monthly-xlsx-report";

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

async function readWorkbookFiles(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  return {
    contentTypes: await readZipText(zip, "[Content_Types].xml"),
    workbook: await readZipText(zip, "xl/workbook.xml"),
    metadata: await readZipText(zip, "xl/worksheets/sheet1.xml"),
    summary: await readZipText(zip, "xl/worksheets/sheet2.xml"),
    planned: await readZipText(zip, "xl/worksheets/sheet3.xml"),
    actual: await readZipText(zip, "xl/worksheets/sheet4.xml"),
  };
}

async function readZipText(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file) throw new Error(`Missing workbook file ${path}`);
  return file.async("string");
}

describe("monthly XLSX report", () => {
  it("exports safe period metadata, deterministic summary totals, planned lines, and transactions as exact minor-unit strings", async () => {
    const result = await buildMonthlyXlsxReport({
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
    if (!result.ok) throw new Error("Expected monthly XLSX report to build");

    expect(result.value.filename).toBe("monthly-report-2026-03.xlsx");
    expect(result.value.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(result.value.workbook.byteLength).toBeGreaterThan(0);

    const workbook = await readWorkbookFiles(result.value.workbook);
    expect(workbook.contentTypes).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml");
    expect(workbook.workbook).toContain('name="Metadata"');
    expect(workbook.workbook).toContain('name="Summary"');
    expect(workbook.workbook).toContain('name="Planned Budget"');
    expect(workbook.workbook).toContain('name="Actual Transactions"');

    expect(workbook.metadata).toContain("<t>monthStart</t>");
    expect(workbook.metadata).toContain("<t>2026-03-01</t>");
    expect(workbook.metadata).toContain("<t>COP</t>");
    expect(workbook.metadata).toContain("<t>America/Bogota</t>");

    expect(workbook.summary).toContain("<t>income</t>");
    expect(workbook.summary).toContain("<t>520000</t>");
    expect(workbook.summary).toContain("<t>totalCashOutflow</t>");
    expect(workbook.summary).toContain("<t>230000</t>");
    expect(workbook.summary).toContain("<t>availableBalance</t>");
    expect(workbook.summary).toContain("<t>290000</t>");

    expect(workbook.planned).toContain("<t>plannedAmountMinor</t>");
    expect(workbook.planned).toContain("<t>Groceries</t>");
    expect(workbook.planned).toContain("<t>200000</t>");
    expect(workbook.actual).toContain("<t>actualAmountMinor</t>");
    expect(workbook.actual).toContain("<t>Food</t>");
    expect(workbook.actual).toContain("<t>80000</t>");

    const serializedCells = Object.values(workbook).join("\n");
    expect(serializedCells).not.toMatch(/userId|owner|ownerUserId|owner note|cookie|credentials/i);
    expect(serializedCells).not.toContain("5200.00");
    expect(serializedCells).not.toContain("800.00");
  });

  it("neutralizes spreadsheet formula prefixes in user-controlled text without changing exact minor-unit values", async () => {
    const result = await buildMonthlyXlsxReport({
      period,
      plannedBudgetLines: [
        plannedLine({ categoryName: "=SUM(A1:A2)", plannedAmountMinor: "12345" }),
        plannedLine({ categoryName: "-starts-with-dash", plannedAmountMinor: "0" }),
      ],
      transactions: [
        transaction({ description: "+cmd|calc", amountMinor: "6789" }),
        transaction({ description: "@import", amountMinor: "999" }),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected formula-safe XLSX report to build");

    const workbook = await readWorkbookFiles(result.value.workbook);
    expect(workbook.planned).toContain("<t>'=SUM(A1:A2)</t>");
    expect(workbook.planned).toContain("<t>'-starts-with-dash</t>");
    expect(workbook.planned).toContain("<t>12345</t>");
    expect(workbook.planned).toContain("<t>0</t>");
    expect(workbook.actual).toContain("<t>'+cmd|calc</t>");
    expect(workbook.actual).toContain("<t>'@import</t>");
    expect(workbook.actual).toContain("<t>6789</t>");
    expect(workbook.actual).toContain("<t>999</t>");
  });
});