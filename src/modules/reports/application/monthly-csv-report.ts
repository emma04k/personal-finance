import { buildMonthlyBudgetSummary, type MonthlyBudgetSummaryError } from "@/modules/budget/application/monthly-budget-summary-workflow";
import type {
  OwnedBudgetLine,
  OwnedPeriod,
  OwnedTransaction,
} from "@/modules/budget/application/owned-planning-repository";
import type { AggregateMoney } from "@/modules/budget/domain/budget-summary";
import { err, ok, type Result } from "@/modules/finance/domain/result";

type MonthlyCsvReport = Readonly<{
  csv: string;
  contentType: "text/csv; charset=utf-8";
  filename: string;
}>;

type MonthlyCsvReportError = MonthlyBudgetSummaryError;

type CsvRow = readonly [
  section: string,
  rowType: string,
  monthStart: string,
  currencyCode: string,
  timeZone: string,
  name: string,
  categoryType: string,
  direction: string,
  occurredOn: string,
  description: string,
  plannedAmountMinor: string,
  actualAmountMinor: string,
  totalMinor: string,
  completeness: string,
  plannedValuesUsed: string,
  detail: string,
];

const csvHeader: CsvRow = [
  "section",
  "rowType",
  "monthStart",
  "currencyCode",
  "timeZone",
  "name",
  "categoryType",
  "direction",
  "occurredOn",
  "description",
  "plannedAmountMinor",
  "actualAmountMinor",
  "totalMinor",
  "completeness",
  "plannedValuesUsed",
  "detail",
];

const textColumnIndexes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 15]);
const spreadsheetFormulaPrefix = /^[=+\-@\t\r]/;

export function buildMonthlyCsvReport({
  period,
  plannedBudgetLines,
  transactions,
}: {
  readonly period: OwnedPeriod;
  readonly plannedBudgetLines: readonly OwnedBudgetLine[];
  readonly transactions: readonly OwnedTransaction[];
}): Result<MonthlyCsvReport, MonthlyCsvReportError> {
  const summaryResult = buildMonthlyBudgetSummary({ period, plannedBudgetLines, transactions });
  if (!summaryResult.ok) return err(summaryResult.error);

  const summary = summaryResult.value;
  const rows: CsvRow[] = [
    csvHeader,
    [
      "metadata",
      "period",
      period.monthStart,
      period.currencyCode,
      period.timeZone,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    summaryRow(period, "income", summary.income),
    summaryRow(period, "consumptionExpenses", summary.consumptionExpenses),
    summaryRow(period, "debtPayments", summary.debtPayments),
    summaryRow(period, "savingsAllocations", summary.savingsAllocations),
    summaryRow(period, "totalCashOutflow", summary.totalCashOutflow),
    [
      "summary",
      "availableBalance",
      period.monthStart,
      period.currencyCode,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      summary.availableBalance.minorUnits.toString(),
      "",
      "",
      "",
    ],
    ...plannedBudgetLines
      .filter((line) => line.periodId === period.id)
      .toSorted(compareBudgetLines)
      .map((line): CsvRow => [
        "planned_budget_line",
        "budgetLine",
        period.monthStart,
        line.currencyCode,
        "",
        line.categoryName,
        line.categoryType,
        "",
        "",
        "",
        line.plannedAmountMinor,
        "",
        "",
        "",
        "",
        "",
      ]),
    ...transactions
      .filter((transaction) => transaction.periodId === period.id)
      .toSorted(compareTransactions)
      .map((transaction): CsvRow => [
        "actual_transaction",
        "transaction",
        period.monthStart,
        transaction.currencyCode,
        "",
        transaction.categoryName,
        transaction.categoryType,
        transaction.direction,
        transaction.occurredOn,
        transaction.description,
        "",
        transaction.amountMinor,
        "",
        "",
        "",
        "",
      ]),
  ];

  return ok({
    csv: `${rows.map(formatCsvRow).join("\n")}\n`,
    contentType: "text/csv; charset=utf-8",
    filename: `monthly-report-${period.monthStart.slice(0, 7)}.csv`,
  });
}

function summaryRow(period: OwnedPeriod, rowType: string, aggregate: AggregateMoney): CsvRow {
  return [
    "summary",
    rowType,
    period.monthStart,
    period.currencyCode,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    aggregate.amount.minorUnits.toString(),
    aggregate.completeness,
    aggregate.plannedValuesUsed ? "true" : "false",
    "",
  ];
}

function formatCsvRow(row: CsvRow): string {
  return row.map((value, index) => escapeCsvValue(textColumnIndexes.has(index) ? neutralizeSpreadsheetFormula(value) : value)).join(",");
}

function neutralizeSpreadsheetFormula(value: string): string {
  if (!spreadsheetFormulaPrefix.test(value)) return value;
  return `'${value}`;
}

function escapeCsvValue(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
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
