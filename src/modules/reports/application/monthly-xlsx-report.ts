import JSZip from "jszip";
import { buildMonthlyBudgetSummary, type MonthlyBudgetSummaryError } from "@/modules/budget/application/monthly-budget-summary-workflow";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import type { AggregateMoney } from "@/modules/budget/domain/budget-summary";
import { err, ok, type Result } from "@/modules/finance/domain/result";

type MonthlyXlsxReport = Readonly<{
  workbook: Buffer;
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  filename: string;
}>;

type MonthlyXlsxReportError = MonthlyBudgetSummaryError;
type WorkbookSheet = Readonly<{ name: string; rows: readonly (readonly string[])[] }>;

const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as const;
const spreadsheetFormulaPrefix = /^[=+\-@\t\r]/;
const deterministicZipDate = new Date("2000-01-01T00:00:00.000Z");

export async function buildMonthlyXlsxReport({
  period,
  plannedBudgetLines,
  transactions,
}: {
  readonly period: OwnedPeriod;
  readonly plannedBudgetLines: readonly OwnedBudgetLine[];
  readonly transactions: readonly OwnedTransaction[];
}): Promise<Result<MonthlyXlsxReport, MonthlyXlsxReportError>> {
  const summaryResult = buildMonthlyBudgetSummary({ period, plannedBudgetLines, transactions });
  if (!summaryResult.ok) return err(summaryResult.error);

  const sheets: WorkbookSheet[] = [
    {
      name: "Metadata",
      rows: [
        ["monthStart", "currencyCode", "timeZone"],
        [period.monthStart, period.currencyCode, period.timeZone],
      ],
    },
    {
      name: "Summary",
      rows: [
        ["rowType", "monthStart", "currencyCode", "totalMinor", "completeness", "plannedValuesUsed", "detail"],
        summaryRow(period, "income", summaryResult.value.income),
        summaryRow(period, "consumptionExpenses", summaryResult.value.consumptionExpenses),
        summaryRow(period, "debtPayments", summaryResult.value.debtPayments),
        summaryRow(period, "savingsAllocations", summaryResult.value.savingsAllocations),
        summaryRow(period, "totalCashOutflow", summaryResult.value.totalCashOutflow),
        ["availableBalance", period.monthStart, period.currencyCode, summaryResult.value.availableBalance.minorUnits.toString(), "", "", ""],
      ],
    },
    {
      name: "Planned Budget",
      rows: [
        ["monthStart", "currencyCode", "name", "categoryType", "plannedAmountMinor"],
        ...plannedBudgetLines
          .filter((line) => line.periodId === period.id)
          .toSorted(compareBudgetLines)
          .map((line) => [
            period.monthStart,
            line.currencyCode,
            neutralizeSpreadsheetFormula(line.categoryName),
            line.categoryType,
            line.plannedAmountMinor,
          ]),
      ],
    },
    {
      name: "Actual Transactions",
      rows: [
        ["monthStart", "currencyCode", "name", "categoryType", "direction", "occurredOn", "description", "actualAmountMinor"],
        ...transactions
          .filter((transaction) => transaction.periodId === period.id)
          .toSorted(compareTransactions)
          .map((transaction) => [
            period.monthStart,
            transaction.currencyCode,
            neutralizeSpreadsheetFormula(transaction.categoryName),
            transaction.categoryType,
            transaction.direction,
            transaction.occurredOn,
            neutralizeSpreadsheetFormula(transaction.description),
            transaction.amountMinor,
          ]),
      ],
    },
  ];

  return ok({
    workbook: await buildWorkbook(sheets),
    contentType: xlsxContentType,
    filename: `monthly-report-${period.monthStart.slice(0, 7)}.xlsx`,
  });
}

async function buildWorkbook(sheets: readonly WorkbookSheet[]): Promise<Buffer> {
  const zip = new JSZip();
  addZipFile(zip, "[Content_Types].xml", buildContentTypes(sheets.length));
  addZipFile(zip, "_rels/.rels", buildRootRelationships());
  addZipFile(zip, "xl/workbook.xml", buildWorkbookXml(sheets));
  addZipFile(zip, "xl/_rels/workbook.xml.rels", buildWorkbookRelationships(sheets.length));

  sheets.forEach((sheet, index) => {
    addZipFile(zip, `xl/worksheets/sheet${index + 1}.xml`, buildWorksheetXml(sheet.rows));
  });

  return zip.generateAsync({ compression: "DEFLATE", type: "nodebuffer" });
}

function addZipFile(zip: JSZip, path: string, content: string) {
  zip.file(path, content, { date: deterministicZipDate });
}

function buildContentTypes(sheetCount: number) {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}</Types>`;
}

function buildRootRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

function buildWorkbookXml(sheets: readonly WorkbookSheet[]) {
  const sheetEntries = sheets.map((sheet, index) => (
    `<sheet name="${escapeXmlAttribute(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`;
}

function buildWorkbookRelationships(sheetCount: number) {
  const relationships = Array.from({ length: sheetCount }, (_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`;
}

function buildWorksheetXml(rows: readonly (readonly string[])[]) {
  const rowXml = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = row.map((value, columnIndex) => (
      `<c r="${columnName(columnIndex + 1)}${rowNumber}" t="inlineStr"><is><t>${escapeXmlText(value)}</t></is></c>`
    )).join("");

    return `<row r="${rowNumber}">${cells}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
}

function summaryRow(period: OwnedPeriod, rowType: string, aggregate: AggregateMoney): string[] {
  return [
    rowType,
    period.monthStart,
    period.currencyCode,
    aggregate.amount.minorUnits.toString(),
    aggregate.completeness,
    aggregate.plannedValuesUsed ? "true" : "false",
    "",
  ];
}

function neutralizeSpreadsheetFormula(value: string): string {
  if (!spreadsheetFormulaPrefix.test(value)) return value;
  return `'${value}`;
}

function columnName(columnNumber: number): string {
  let name = "";
  let remaining = columnNumber;
  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    remaining = Math.floor((remaining - modulo) / 26);
  }
  return name;
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function compareBudgetLines(left: OwnedBudgetLine, right: OwnedBudgetLine): number {
  return compareStrings(
    `${left.categoryType}\u0000${left.categoryName}\u0000${left.categoryId}\u0000${left.id}`,
    `${right.categoryType}\u0000${right.categoryName}\u0000${right.categoryId}\u0000${right.id}`,
  );
}

function compareTransactions(left: OwnedTransaction, right: OwnedTransaction): number {
  return compareStrings(
    `${left.occurredOn}\u0000${left.categoryName}\u0000${left.description}\u0000${left.id}`,
    `${right.occurredOn}\u0000${right.categoryName}\u0000${right.description}\u0000${right.id}`,
  );
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}