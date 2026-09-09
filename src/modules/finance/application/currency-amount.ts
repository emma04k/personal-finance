import { createCurrencyCode } from "@/modules/finance/domain/money";

export const MAX_SIGNED_64_BIT_MINOR_UNITS = BigInt("9223372036854775807");

const currencyExponents = Object.freeze({
  COP: 2,
  JPY: 0,
  KWD: 3,
  USD: 2,
} as const);

type CurrencyWithExponent = keyof typeof currencyExponents;

export function parseCurrencyAmountToMinorUnits(input: unknown, currencyCode: string): string | null {
  if (typeof input !== "string") return null;
  if (!hasCurrencyExponent(currencyCode)) return null;

  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(input);
  if (!match) return null;

  const exponent = currencyExponents[currencyCode];
  const fractionalPart = match[2] ?? "";
  if (fractionalPart.length > exponent) return null;
  if (exponent === 0 && fractionalPart.length > 0) return null;

  const wholePart = match[1];
  const scaledFraction = fractionalPart.padEnd(exponent, "0");
  const rawMinorUnits = `${wholePart}${scaledFraction}`;
  const minorUnits = BigInt(rawMinorUnits);

  if (minorUnits > MAX_SIGNED_64_BIT_MINOR_UNITS) return null;
  return minorUnits.toString();
}

export function formatCurrencyMinorUnits(minorUnits: string, currencyCode: string): string {
  if (!hasCurrencyExponent(currencyCode) || !/^-?(0|[1-9][0-9]*)$/.test(minorUnits)) {
    return `${minorUnits} ${currencyCode}`;
  }

  const exponent = currencyExponents[currencyCode];
  const negative = minorUnits.startsWith("-");
  const absoluteMinorUnits = negative ? minorUnits.slice(1) : minorUnits;
  const padded = absoluteMinorUnits.padStart(exponent + 1, "0");
  const wholePart = exponent === 0 ? padded : padded.slice(0, -exponent);
  const fractionalPart = exponent === 0 ? "" : padded.slice(-exponent);
  const amount = exponent === 0
    ? groupIntegerPart(wholePart)
    : `${groupIntegerPart(wholePart)}.${fractionalPart}`;

  return `${currencyCode} ${negative ? "-" : ""}${amount}`;
}

function hasCurrencyExponent(currencyCode: string): currencyCode is CurrencyWithExponent {
  return createCurrencyCode(currencyCode).ok && currencyCode in currencyExponents;
}

function groupIntegerPart(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
