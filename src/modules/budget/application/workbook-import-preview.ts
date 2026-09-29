import JSZip from "jszip";
import { createCurrencyCode } from "@/modules/finance/domain/money";
import { MAX_SIGNED_64_BIT_MINOR_UNITS } from "@/modules/finance/application/currency-amount";

export type WorkbookImportPreviewRowType =
  | "planned-income"
  | "actual-income"
  | "planned-expense"
  | "actual-expense";

export type WorkbookImportPreviewRow = Readonly<{
  type: WorkbookImportPreviewRowType;
  rowNumber: number;
  description: string;
  amountMinor: string;
  currencyCode: string;
}>;

export type WorkbookImportIssue = Readonly<{
  code:
    | "MALFORMED_WORKBOOK"
    | "UNSUPPORTED_SHEET"
    | "MISSING_HEADER"
    | "UNKNOWN_CURRENCY"
    | "INCOMPLETE_ROW"
    | "DUPLICATE_ROW"
    | "INVALID_MONEY"
    | "UNSUPPORTED_FORMULA"
    | "UNSUPPORTED_WORKBOOK_FEATURE";
  rowNumber?: number;
  type?: WorkbookImportPreviewRowType;
  sheetName?: string;
  currencyCode?: string;
}>;

export type WorkbookImportPreview = Readonly<{
  rows: readonly WorkbookImportPreviewRow[];
  issues: readonly WorkbookImportIssue[];
}>;

type CellValue = Readonly<{ value: string; formula: boolean }>;
type SheetRow = Readonly<{ rowNumber: number; cells: ReadonlyMap<number, CellValue> }>;
type HeaderColumns = Readonly<{
  incomeDescription: number;
  plannedIncome: number;
  actualIncome: number;
  expenseDescription: number;
  plannedExpense: number;
  actualExpense: number;
}>;

type PreviewColumnMapping = Readonly<{
  type: WorkbookImportPreviewRowType;
  descriptionColumn: number;
  amountColumn: number;
}>;

const supportedSheetName = "Formato Presupuesto";
const canonicalMinorUnits = /^(0|[1-9][0-9]*)$/;
const xmlRelationshipNamespace = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const maxWorkbookXmlBytes = 256_000;
const maxRelationshipXmlBytes = 256_000;
const maxSharedStringsXmlBytes = 1_000_000;
const maxWorksheetXmlBytes = 1_000_000;
const maxSharedStringCount = 10_000;
const maxSharedStringBytes = 32_000;
const maxTotalSharedStringBytes = 512_000;
const maxWorksheetRows = 1_000;
const maxWorksheetCells = 10_000;

type BoundedZipText = Readonly<{ ok: true; text: string | null }> | Readonly<{ ok: false }>;

export async function parseWorkbookImportPreview({
  workbook,
  currencyCode,
}: {
  readonly workbook: Buffer | Uint8Array | ArrayBuffer;
  readonly currencyCode: string;
}): Promise<WorkbookImportPreview> {
  const validCurrency = createCurrencyCode(currencyCode);
  if (!validCurrency.ok) {
    return { rows: [], issues: [{ code: "UNKNOWN_CURRENCY", currencyCode }] };
  }

  let zip: JSZip;
  try {
    if (!hasZipMagic(workbook)) return { rows: [], issues: [{ code: "MALFORMED_WORKBOOK" }] };
    zip = await JSZip.loadAsync(workbook);
  } catch {
    return { rows: [], issues: [{ code: "MALFORMED_WORKBOOK" }] };
  }

  const featureIssues = unsupportedFeatureIssues(zip);
  const sheetPathResult = await findSheetPath(zip, supportedSheetName);
  if (!sheetPathResult.ok) return { rows: [], issues: [{ code: "MALFORMED_WORKBOOK" }] };
  if (!sheetPathResult.path) {
    return {
      rows: [],
      issues: [...featureIssues, { code: "UNSUPPORTED_SHEET", sheetName: supportedSheetName }],
    };
  }

  const sharedStrings = await readSharedStrings(zip);
  if (!sharedStrings.ok) return { rows: [], issues: [{ code: "MALFORMED_WORKBOOK" }] };

  const sheetXml = await readZipText(zip, sheetPathResult.path, maxWorksheetXmlBytes);
  if (!sheetXml.ok || sheetXml.text === null) return { rows: [], issues: [{ code: "MALFORMED_WORKBOOK" }] };
  const rows = parseSheetRows(sheetXml.text, sharedStrings.strings);
  if (rows === null) return { rows: [], issues: [{ code: "MALFORMED_WORKBOOK" }] };
  const header = findHeader(rows);
  if (!header) {
    return { rows: [], issues: [...featureIssues, { code: "MISSING_HEADER", sheetName: supportedSheetName }] };
  }
  if (headerHasFormula(header)) {
    return { rows: [], issues: [...featureIssues, { code: "UNSUPPORTED_FORMULA", rowNumber: header.row.rowNumber }] };
  }

  return buildPreview(rows, header, currencyCode, featureIssues);
}

function unsupportedFeatureIssues(zip: JSZip): WorkbookImportIssue[] {
  const names = Object.keys(zip.files);
  const issues: WorkbookImportIssue[] = [];
  if (names.some((name) => /(^|\/)vbaProject\.bin$/i.test(name))) {
    issues.push({ code: "UNSUPPORTED_WORKBOOK_FEATURE" });
  }
  if (names.some((name) => /^xl\/externalLinks\//i.test(name))) {
    issues.push({ code: "UNSUPPORTED_WORKBOOK_FEATURE" });
  }
  return issues;
}

function hasZipMagic(workbook: Buffer | Uint8Array | ArrayBuffer) {
  const bytes = workbook instanceof ArrayBuffer ? new Uint8Array(workbook) : new Uint8Array(workbook.buffer, workbook.byteOffset, workbook.byteLength);
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

async function readZipText(zip: JSZip, path: string, maxBytes: number): Promise<BoundedZipText> {
  const file = zip.file(path);
  if (!file) return { ok: true, text: null };
  const uncompressedSize = zipEntryUncompressedSize(file);
  if (uncompressedSize === null || uncompressedSize > maxBytes) return { ok: false };

  try {
    const bytes = await file.async("uint8array", (metadata) => {
      if (uncompressedSize * (metadata.percent / 100) > maxBytes) throw new Error("xlsx-entry-too-large");
    });
    if (bytes.byteLength > maxBytes) return { ok: false };
    return { ok: true, text: new TextDecoder().decode(bytes) };
  } catch {
    return { ok: false };
  }
}

function zipEntryUncompressedSize(file: JSZip.JSZipObject) {
  const candidate = file as JSZip.JSZipObject & { readonly _data?: { readonly uncompressedSize?: unknown } };
  return typeof candidate._data?.uncompressedSize === "number" ? candidate._data.uncompressedSize : null;
}

async function findSheetPath(zip: JSZip, sheetName: string) {
  const workbookXml = await readZipText(zip, "xl/workbook.xml", maxWorkbookXmlBytes);
  const relationshipXml = await readZipText(zip, "xl/_rels/workbook.xml.rels", maxRelationshipXmlBytes);
  if (!workbookXml.ok || !relationshipXml.ok) return { ok: false } as const;
  if (!workbookXml.text || !relationshipXml.text) return { ok: true, path: null } as const;

  const relationshipTargets = parseRelationships(relationshipXml.text);
  const sheetPattern = /<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g;
  for (const match of workbookXml.text.matchAll(sheetPattern)) {
    const attributes = parseAttributes(match[1]);
    if (decodeXml(attributes.name ?? "") !== sheetName) continue;
    const relationshipId = attributes["r:id"] ?? attributes.id;
    if (!relationshipId) continue;
    const target = relationshipTargets.get(relationshipId);
    if (!target) continue;
    return { ok: true, path: normalizeWorkbookTarget(target) } as const;
  }

  return { ok: true, path: null } as const;
}

function parseRelationships(xml: string) {
  const relationships = new Map<string, string>();
  const relationshipPattern = /<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g;
  for (const match of xml.matchAll(relationshipPattern)) {
    const attributes = parseAttributes(match[1]);
    if (attributes.Type !== xmlRelationshipNamespace && !attributes.Type?.endsWith("/worksheet")) continue;
    if (attributes.Id && attributes.Target) relationships.set(attributes.Id, attributes.Target);
  }
  return relationships;
}

function normalizeWorkbookTarget(target: string) {
  if (target.startsWith("/")) return target.slice(1);
  if (target.startsWith("xl/")) return target;
  return `xl/${target}`;
}

async function readSharedStrings(zip: JSZip) {
  const sharedStringsXml = await readZipText(zip, "xl/sharedStrings.xml", maxSharedStringsXmlBytes);
  if (!sharedStringsXml.ok) return { ok: false } as const;
  if (!sharedStringsXml.text) return { ok: true, strings: [] } as const;

  const strings: string[] = [];
  let totalSharedStringBytes = 0;
  for (const match of sharedStringsXml.text.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    if (strings.length >= maxSharedStringCount) return { ok: false } as const;
    const value = readTextRuns(match[1]);
    const valueBytes = new TextEncoder().encode(value).byteLength;
    totalSharedStringBytes += valueBytes;
    if (valueBytes > maxSharedStringBytes || totalSharedStringBytes > maxTotalSharedStringBytes) return { ok: false } as const;
    strings.push(value);
  }
  return { ok: true, strings } as const;
}

function parseSheetRows(xml: string, sharedStrings: readonly string[]): SheetRow[] | null {
  const rows: SheetRow[] = [];
  let fallbackRowNumber = 1;
  let cellCount = 0;
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    if (rows.length >= maxWorksheetRows) return null;
    const rowAttributes = parseAttributes(rowMatch[1]);
    const rowNumber = parsePositiveInteger(rowAttributes.r) ?? fallbackRowNumber;
    fallbackRowNumber = rowNumber + 1;
    const cells = new Map<number, CellValue>();

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      cellCount += 1;
      if (cellCount > maxWorksheetCells) return null;
      const attributes = parseAttributes(cellMatch[1]);
      const column = columnIndexFromReference(attributes.r);
      if (column === null) continue;
      cells.set(column, parseCellValue(attributes, cellMatch[2], sharedStrings));
    }

    rows.push({ rowNumber, cells });
  }
  return rows;
}

function parseCellValue(
  attributes: Readonly<Record<string, string>>,
  cellXml: string,
  sharedStrings: readonly string[],
): CellValue {
  const formula = /<f\b[^>]*>/.test(cellXml) || /<f\b[^>]*\/>/.test(cellXml);
  if (attributes.t === "inlineStr") return { value: readTextRuns(cellXml), formula };

  const rawValue = firstTagValue(cellXml, "v");
  if (attributes.t === "s") {
    const sharedStringIndex = parsePositiveInteger(rawValue);
    return {
      value: sharedStringIndex === null ? "" : (sharedStrings[sharedStringIndex] ?? ""),
      formula,
    };
  }

  if (attributes.t === "str") return { value: rawValue, formula };
  return { value: decodeXml(rawValue), formula };
}

function readTextRuns(xml: string) {
  return Array.from(xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g), (match) => decodeXml(match[1])).join("");
}

function firstTagValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`));
  return match ? decodeXml(match[1]) : "";
}

function findHeader(rows: readonly SheetRow[]): { row: SheetRow; columns: HeaderColumns } | null {
  for (const row of rows) {
    const byHeader = new Map<string, number>();
    for (const [column, cell] of row.cells) byHeader.set(normalizeHeader(cell.value), column);

    const columns = {
      incomeDescription: findHeaderColumn(byHeader, ["descripcion ingreso", "income description"]),
      plannedIncome: findHeaderColumn(byHeader, ["ingreso planeado", "planned income"]),
      actualIncome: findHeaderColumn(byHeader, ["ingreso real", "actual income"]),
      expenseDescription: findHeaderColumn(byHeader, ["descripcion gasto", "expense description"]),
      plannedExpense: findHeaderColumn(byHeader, ["gasto planeado", "planned expense"]),
      actualExpense: findHeaderColumn(byHeader, ["gasto real", "actual expense"]),
    };

    if (Object.values(columns).every((value): value is number => value !== null)) {
      return { row, columns: columns as HeaderColumns };
    }
  }

  return null;
}

function headerHasFormula(header: { readonly row: SheetRow; readonly columns: HeaderColumns }) {
  return Object.values(header.columns).some((column) => header.row.cells.get(column)?.formula === true);
}

function findHeaderColumn(headers: ReadonlyMap<string, number>, candidates: readonly string[]) {
  for (const candidate of candidates) {
    const column = headers.get(normalizeHeader(candidate));
    if (column !== undefined) return column;
  }
  return null;
}

function buildPreview(
  rows: readonly SheetRow[],
  header: { readonly row: SheetRow; readonly columns: HeaderColumns },
  currencyCode: string,
  initialIssues: readonly WorkbookImportIssue[],
): WorkbookImportPreview {
  const previewRows: WorkbookImportPreviewRow[] = [];
  const issues: WorkbookImportIssue[] = [...initialIssues];
  const seen = new Set<string>();
  const mappings: PreviewColumnMapping[] = [
    { type: "planned-income", descriptionColumn: header.columns.incomeDescription, amountColumn: header.columns.plannedIncome },
    { type: "actual-income", descriptionColumn: header.columns.incomeDescription, amountColumn: header.columns.actualIncome },
    { type: "planned-expense", descriptionColumn: header.columns.expenseDescription, amountColumn: header.columns.plannedExpense },
    { type: "actual-expense", descriptionColumn: header.columns.expenseDescription, amountColumn: header.columns.actualExpense },
  ];

  for (const row of rows.filter((candidate) => candidate.rowNumber > header.row.rowNumber)) {
    const formulaOnlyDescriptionColumnsReported = new Set<number>();
    for (const mapping of mappings) {
      const descriptionCell = row.cells.get(mapping.descriptionColumn);
      const description = descriptionCell?.value.trim() ?? "";
      const amountCell = row.cells.get(mapping.amountColumn);
      const amountRaw = amountCell?.value ?? "";
      const hasAmount = amountRaw.length > 0 || amountCell?.formula === true;
      const hasDescription = description.length > 0 || descriptionCell?.formula === true;

      if (!hasDescription && !hasAmount) continue;
      if (!hasDescription && hasAmount) {
        issues.push({ code: "INCOMPLETE_ROW", rowNumber: row.rowNumber, type: mapping.type });
        continue;
      }
      if (descriptionCell?.formula) {
        if (hasAmount || !formulaOnlyDescriptionColumnsReported.has(mapping.descriptionColumn)) {
          issues.push({ code: "UNSUPPORTED_FORMULA", rowNumber: row.rowNumber, type: mapping.type });
          formulaOnlyDescriptionColumnsReported.add(mapping.descriptionColumn);
        }
        continue;
      }
      if (!hasAmount) continue;
      if (amountCell?.formula) {
        issues.push({ code: "UNSUPPORTED_FORMULA", rowNumber: row.rowNumber, type: mapping.type });
        continue;
      }

      const amountMinor = parseCanonicalMinorUnits(amountRaw);
      if (amountMinor === null) {
        issues.push({ code: "INVALID_MONEY", rowNumber: row.rowNumber, type: mapping.type });
        continue;
      }

      const duplicateKey = `${mapping.type}\u0000${normalizeDuplicateDescription(description)}`;
      if (seen.has(duplicateKey)) {
        issues.push({ code: "DUPLICATE_ROW", rowNumber: row.rowNumber, type: mapping.type });
        continue;
      }
      seen.add(duplicateKey);

      previewRows.push({
        type: mapping.type,
        rowNumber: row.rowNumber,
        description,
        amountMinor,
        currencyCode,
      });
    }
  }

  return { rows: previewRows, issues };
}

function parseCanonicalMinorUnits(value: string) {
  if (!canonicalMinorUnits.test(value)) return null;
  const minorUnits = BigInt(value);
  if (minorUnits > MAX_SIGNED_64_BIT_MINOR_UNITS) return null;
  return minorUnits.toString();
}

function parseAttributes(input: string) {
  const attributes: Record<string, string> = {};
  for (const match of input.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function parsePositiveInteger(value: string | undefined) {
  if (value === undefined || !/^[0-9]+$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

function columnIndexFromReference(reference: string | undefined) {
  if (!reference) return null;
  const match = /^([A-Z]+)[0-9]+$/i.exec(reference);
  if (!match) return null;
  let index = 0;
  for (const character of match[1].toUpperCase()) {
    index = index * 26 + character.charCodeAt(0) - 64;
  }
  return index;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDuplicateDescription(value: string) {
  return normalizeHeader(value);
}

function decodeXml(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
