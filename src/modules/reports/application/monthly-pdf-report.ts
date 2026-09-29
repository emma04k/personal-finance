import { buildMonthlyBudgetSummary, type MonthlyBudgetSummaryError } from "@/modules/budget/application/monthly-budget-summary-workflow";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import type { AggregateMoney } from "@/modules/budget/domain/budget-summary";
import { err, ok, type Result } from "@/modules/finance/domain/result";

type MonthlyPdfReport = Readonly<{
  pdf: Buffer;
  contentType: "application/pdf";
  filename: string;
}>;

type MonthlyPdfReportError = MonthlyBudgetSummaryError;

type PdfTextLine = Readonly<{
  text: string;
  size?: number;
  gapAfter?: number;
}>;

const pdfContentType = "application/pdf" as const;
const pdfLineHeight = 14;
const pdfLeftMargin = 50;
const pdfTop = 790;

export function buildMonthlyPdfReport({
  period,
  plannedBudgetLines,
  transactions,
}: {
  readonly period: OwnedPeriod;
  readonly plannedBudgetLines: readonly OwnedBudgetLine[];
  readonly transactions: readonly OwnedTransaction[];
}): Result<MonthlyPdfReport, MonthlyPdfReportError> {
  const summaryResult = buildMonthlyBudgetSummary({ period, plannedBudgetLines, transactions });
  if (!summaryResult.ok) return err(summaryResult.error);

  const summary = summaryResult.value;
  const lines: PdfTextLine[] = [
    { text: `Monthly report ${period.monthStart.slice(0, 7)}`, size: 18, gapAfter: 8 },
    { text: `Period: ${period.monthStart}` },
    { text: `Currency: ${period.currencyCode}` },
    { text: `Time zone: ${period.timeZone}`, gapAfter: 8 },
    { text: "Summary", size: 14 },
    summaryLine("income", summary.income),
    summaryLine("consumptionExpenses", summary.consumptionExpenses),
    summaryLine("debtPayments", summary.debtPayments),
    summaryLine("savingsAllocations", summary.savingsAllocations),
    summaryLine("totalCashOutflow", summary.totalCashOutflow),
    { text: `availableBalance | totalMinor ${summary.availableBalance.minorUnits.toString()}`, gapAfter: 8 },
    { text: "Planned budget lines", size: 14 },
    ...plannedBudgetLines
      .filter((line) => line.periodId === period.id)
      .toSorted(compareBudgetLines)
      .map((line): PdfTextLine => ({
        text: `${line.categoryName} | ${line.categoryType} | plannedMinor ${line.plannedAmountMinor}`,
      })),
    { text: "Actual transactions", size: 14, gapAfter: 2 },
    ...transactions
      .filter((transaction) => transaction.periodId === period.id)
      .toSorted(compareTransactions)
      .map((transaction): PdfTextLine => ({
        text: `${transaction.occurredOn} | ${transaction.categoryName} | ${transaction.categoryType} | ${transaction.direction} | actualMinor ${transaction.amountMinor} | ${transaction.description}`,
      })),
  ];

  return ok({
    pdf: buildPdf(lines),
    contentType: pdfContentType,
    filename: `monthly-report-${period.monthStart.slice(0, 7)}.pdf`,
  });
}

function summaryLine(rowType: string, aggregate: AggregateMoney): PdfTextLine {
  return {
    text: `${rowType} | totalMinor ${aggregate.amount.minorUnits.toString()} | completeness ${aggregate.completeness} | plannedValuesUsed ${aggregate.plannedValuesUsed ? "true" : "false"}`,
  };
}

function buildPdf(lines: readonly PdfTextLine[]): Buffer {
  const content = buildContentStream(lines);
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets.slice(1).map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

function buildContentStream(lines: readonly PdfTextLine[]): string {
  const commands = ["BT", `/F1 12 Tf`, `${pdfLeftMargin} ${pdfTop} Td`];
  let currentSize = 12;
  let firstLine = true;

  for (const line of lines.flatMap(wrapPdfLine)) {
    const size = line.size ?? 12;
    if (size !== currentSize) {
      commands.push(`/F1 ${size} Tf`);
      currentSize = size;
    }
    if (!firstLine) {
      commands.push(`0 -${line.gapAfter ? pdfLineHeight + line.gapAfter : pdfLineHeight} Td`);
    }
    commands.push(`(${escapePdfText(line.text)}) Tj`);
    firstLine = false;
  }

  commands.push("ET");
  return commands.join("\n");
}

function wrapPdfLine(line: PdfTextLine): PdfTextLine[] {
  const sanitized = sanitizePdfText(line.text);
  if (sanitized.length <= 100) return [{ ...line, text: sanitized }];

  const wrapped: PdfTextLine[] = [];
  let remaining = sanitized;
  while (remaining.length > 100) {
    const breakAt = Math.max(remaining.lastIndexOf(" ", 100), 60);
    wrapped.push({ text: remaining.slice(0, breakAt), size: line.size });
    remaining = remaining.slice(breakAt).trimStart();
  }
  wrapped.push({ ...line, text: remaining });
  return wrapped;
}

function sanitizePdfText(value: string): string {
  return value
    .replace(/[\t\n\r]+/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");
}

function escapePdfText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
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
