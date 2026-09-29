import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseWorkbookImportPreview } from "@/modules/budget/application/workbook-import-preview";

type Cell = string | number | null | { readonly formula: string; readonly cached?: string | number };

async function buildWorkbook(rows: readonly (readonly Cell[])[], sheetName = "Formato Presupuesto") {
  return buildWorkbookWithSheetXml(buildSheet(rows), sheetName);
}

async function buildWorkbookWithSheetXml(sheetXml: string, sheetName = "Formato Presupuesto") {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/worksheets/sheet1.xml", sheetXml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function buildSheet(rows: readonly (readonly Cell[])[]) {
  const rowXml = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = row.map((cell, columnIndex) => {
      if (cell === null) return "";
      const ref = `${columnName(columnIndex + 1)}${rowNumber}`;
      if (typeof cell === "object") {
        const cached = cell.cached === undefined ? "" : `<v>${escapeXml(String(cell.cached))}</v>`;
        return `<c r="${ref}"><f>${escapeXml(cell.formula)}</f>${cached}</c>`;
      }
      if (typeof cell === "number") return `<c r="${ref}"><v>${cell}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
    }).join("");
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
}

function columnName(columnNumber: number) {
  let name = "";
  let remaining = columnNumber;
  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    remaining = Math.floor((remaining - modulo) / 26);
  }
  return name;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const header = [
  "Descripción ingreso",
  "Ingreso planeado",
  "Ingreso real",
  "Descripción gasto",
  "Gasto planeado",
  "Gasto real",
  "Variación gasto",
];

describe("workbook import preview parser", () => {
  it("previews complete supported Formato Presupuesto income and expense rows as canonical minor-unit strings", async () => {
    const workbook = await buildWorkbook([
      header,
      ["Salary", "500000", "520000", "Rent", "120000", "119000", "1000"],
      ["Bonus", 10000, null, "Groceries", null, 45000, null],
    ]);

    const preview = await parseWorkbookImportPreview({ workbook, currencyCode: "COP" });

    expect(preview.rows).toEqual([
      { type: "planned-income", rowNumber: 2, description: "Salary", amountMinor: "500000", currencyCode: "COP" },
      { type: "actual-income", rowNumber: 2, description: "Salary", amountMinor: "520000", currencyCode: "COP" },
      { type: "planned-expense", rowNumber: 2, description: "Rent", amountMinor: "120000", currencyCode: "COP" },
      { type: "actual-expense", rowNumber: 2, description: "Rent", amountMinor: "119000", currencyCode: "COP" },
      { type: "planned-income", rowNumber: 3, description: "Bonus", amountMinor: "10000", currencyCode: "COP" },
      { type: "actual-expense", rowNumber: 3, description: "Groceries", amountMinor: "45000", currencyCode: "COP" },
    ]);
    expect(preview.issues).toEqual([]);
  });

  it("flags malformed workbooks and missing supported sheets without throwing", async () => {
    const malformed = await parseWorkbookImportPreview({ workbook: Buffer.from("not a zip"), currencyCode: "COP" });
    const missingSheet = await parseWorkbookImportPreview({
      workbook: await buildWorkbook([header, ["Salary", "1", null, null, null, null, null]], "Other"),
      currencyCode: "COP",
    });

    expect(malformed.rows).toEqual([]);
    expect(malformed.issues).toContainEqual({ code: "MALFORMED_WORKBOOK" });
    expect(missingSheet.rows).toEqual([]);
    expect(missingSheet.issues).toContainEqual({ code: "UNSUPPORTED_SHEET", sheetName: "Formato Presupuesto" });
  });

  it("flags incomplete, duplicate, invalid-money, and formula cells instead of guessing", async () => {
    const workbook = await buildWorkbook([
      header,
      ["Salary", "500000", null, "Rent", "120000", null, null],
      ["Salary", "500000", null, null, null, null, null],
      ["", "75000", null, "Utilities", null, "12.50", null],
      ["Formula pay", { formula: "SUM(A1:A2)", cached: "100" }, null, null, null, null, null],
      ["Negative pay", "-1", null, null, null, null, null],
    ]);

    const preview = await parseWorkbookImportPreview({ workbook, currencyCode: "COP" });

    expect(preview.rows).toEqual([
      { type: "planned-income", rowNumber: 2, description: "Salary", amountMinor: "500000", currencyCode: "COP" },
      { type: "planned-expense", rowNumber: 2, description: "Rent", amountMinor: "120000", currencyCode: "COP" },
    ]);
    expect(preview.issues).toEqual(expect.arrayContaining([
      { code: "DUPLICATE_ROW", rowNumber: 3, type: "planned-income" },
      { code: "INCOMPLETE_ROW", rowNumber: 4, type: "planned-income" },
      { code: "INVALID_MONEY", rowNumber: 4, type: "actual-expense" },
      { code: "UNSUPPORTED_FORMULA", rowNumber: 5, type: "planned-income" },
      { code: "INVALID_MONEY", rowNumber: 6, type: "planned-income" },
    ]));
  });

  it("flags formula-backed description cells instead of trusting cached formula text", async () => {
    const workbook = await buildWorkbook([
      header,
      [{ formula: "\"Salary\"", cached: "Salary" }, "500000", null, null, null, null, null],
    ]);

    const preview = await parseWorkbookImportPreview({ workbook, currencyCode: "COP" });

    expect(preview.rows).toEqual([]);
    expect(preview.issues).toContainEqual({ code: "UNSUPPORTED_FORMULA", rowNumber: 2, type: "planned-income" });
  });

  it("flags formula-backed description-only rows even when no supported amount is present", async () => {
    const workbook = await buildWorkbook([
      header,
      [{ formula: "\"Salary\"", cached: "Salary" }, null, null, null, null, null, null],
    ]);

    const preview = await parseWorkbookImportPreview({ workbook, currencyCode: "COP" });

    expect(preview.rows).toEqual([]);
    expect(preview.issues).toContainEqual({ code: "UNSUPPORTED_FORMULA", rowNumber: 2, type: "planned-income" });
  });

  it("flags formula-backed header cells instead of trusting cached formula text", async () => {
    const workbook = await buildWorkbook([
      [{ formula: "\"Descripción ingreso\"", cached: "Descripción ingreso" }, ...header.slice(1)],
      ["Salary", "500000", null, null, null, null, null],
    ]);

    const preview = await parseWorkbookImportPreview({ workbook, currencyCode: "COP" });

    expect(preview.rows).toEqual([]);
    expect(preview.issues).toContainEqual({ code: "UNSUPPORTED_FORMULA", rowNumber: 1 });
  });

  it("rejects compressed workbooks whose inflated worksheet XML exceeds preview limits", async () => {
    const inflatedSheetXml = buildSheet([
      header,
      ["Salary", "500000", null, null, null, null, null],
    ]).replace("</worksheet>", `${" ".repeat(1_100_000)}</worksheet>`);
    const workbook = await buildWorkbookWithSheetXml(inflatedSheetXml);

    expect(workbook.byteLength).toBeLessThan(20_000);

    const preview = await parseWorkbookImportPreview({ workbook, currencyCode: "COP" });

    expect(preview.rows).toEqual([]);
    expect(preview.issues).toContainEqual({ code: "MALFORMED_WORKBOOK" });
  });

  it("flags an unsupported period currency before reading money", async () => {
    const workbook = await buildWorkbook([header, ["Salary", "500000", null, null, null, null, null]]);

    const preview = await parseWorkbookImportPreview({ workbook, currencyCode: "EUR" });

    expect(preview.rows).toEqual([]);
    expect(preview.issues).toContainEqual({ code: "UNKNOWN_CURRENCY", currencyCode: "EUR" });
  });
});
