import { describe, expect, it } from "vitest";
import { formatEditableCurrencyMinorUnits } from "@/modules/finance/application/currency-amount";

describe("editable currency minor-unit formatting", () => {
  it.each([
    ["COP", "12345", "123.45"],
    ["USD", "12345", "123.45"],
    ["JPY", "12345", "12345"],
    ["KWD", "12345", "12.345"],
  ])("formats %s minor units for edit inputs", (currencyCode, minorUnits, expected) => {
    expect(formatEditableCurrencyMinorUnits(minorUnits, currencyCode)).toBe(expected);
  });

  it("pads small minor-unit amounts without floating-point arithmetic", () => {
    expect(formatEditableCurrencyMinorUnits("5", "USD")).toBe("0.05");
    expect(formatEditableCurrencyMinorUnits("5", "KWD")).toBe("0.005");
  });

  it("preserves very large canonical integers without floating-point rounding", () => {
    expect(formatEditableCurrencyMinorUnits("9007199254740993", "USD")).toBe("90071992547409.93");
  });

  it.each([
    ["unsupported currency", "12345", "EUR"],
    ["malformed currency", "12345", "EURO"],
    ["leading-zero minor units", "00123", "USD"],
    ["decimal minor units", "12.3", "USD"],
  ])("falls back to the original value for %s", (_label, minorUnits, currencyCode) => {
    expect(formatEditableCurrencyMinorUnits(minorUnits, currencyCode)).toBe(minorUnits);
  });
});
