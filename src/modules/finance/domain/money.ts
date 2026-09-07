import { err, ok, type Result } from "./result";
declare const currencyCodeBrand: unique symbol;
export type CurrencyCode = string & { readonly [currencyCodeBrand]: "CurrencyCode" };
declare const moneyBrand: unique symbol;
type SafeError<Code extends string, Field extends string> = Readonly<{ code: Code; field: Field }>;
export type CurrencyCodeError = SafeError<
  "INVALID_CURRENCY_CODE" | "UNSUPPORTED_CURRENCY", "currency"
>;
export type MoneyValidationError = SafeError<
  "INVALID_MINOR_UNITS" | "NEGATIVE_MONEY", "minorUnits"
>;
export type CurrencyMismatchError = SafeError<"CURRENCY_MISMATCH", "currency">;
export type MoneyPayloadError = SafeError<"INVALID_MONEY_PAYLOAD", "payload" | "minorUnits">;
export interface Money {
  readonly [moneyBrand]: "Money";
  readonly minorUnits: bigint;
  readonly currency: CurrencyCode;
}
export interface SerializedMoney {
  readonly minorUnits: string;
  readonly currency: string;
}
const SUPPORTED_CURRENCIES = new Set(["COP", "JPY", "KWD", "USD"]);
const CANONICAL_MINOR_UNITS = /^-?(0|[1-9][0-9]*)$/;
const CURRENCY_MISMATCH: CurrencyMismatchError = Object.freeze({
  code: "CURRENCY_MISMATCH", field: "currency",
});
export function createCurrencyCode(input: unknown): Result<CurrencyCode, CurrencyCodeError> {
  if (typeof input !== "string" || !/^[A-Z]{3}$/.test(input))
    return err({ code: "INVALID_CURRENCY_CODE", field: "currency" });
  return SUPPORTED_CURRENCIES.has(input)
    ? ok(input as CurrencyCode)
    : err({ code: "UNSUPPORTED_CURRENCY", field: "currency" });
}
function createMoney(minorUnits: bigint, currency: CurrencyCode): Money {
  return Object.freeze({ minorUnits, currency }) as Money;
}
function validatedMoney(minorUnits: bigint, currency: CurrencyCode) {
  const validCurrency = createCurrencyCode(currency);
  return validCurrency.ok ? ok(createMoney(minorUnits, validCurrency.value)) : validCurrency;
}
export function money(
  minorUnits: bigint, currency: CurrencyCode,
): Result<Money, MoneyValidationError | CurrencyCodeError> {
  return typeof minorUnits === "bigint"
    ? validatedMoney(minorUnits, currency)
    : err({ code: "INVALID_MINOR_UNITS", field: "minorUnits" });
}
export function nonNegativeMoney(
  minorUnits: bigint, currency: CurrencyCode,
): Result<Money, MoneyValidationError | CurrencyCodeError> {
  if (typeof minorUnits !== "bigint")
    return err({ code: "INVALID_MINOR_UNITS", field: "minorUnits" });
  return minorUnits >= BigInt("0")
    ? validatedMoney(minorUnits, currency)
    : err({ code: "NEGATIVE_MONEY", field: "minorUnits" });
}
function combineMoney(
  left: Money, right: Money, operation: (left: bigint, right: bigint) => bigint,
): Result<Money, CurrencyMismatchError | CurrencyCodeError> {
  const leftCurrency = createCurrencyCode(left.currency);
  if (!leftCurrency.ok) return leftCurrency;
  const rightCurrency = createCurrencyCode(right.currency);
  if (!rightCurrency.ok) return rightCurrency;
  if (leftCurrency.value !== rightCurrency.value) return err(CURRENCY_MISMATCH);
  return ok(createMoney(operation(left.minorUnits, right.minorUnits), leftCurrency.value));
}
export function addMoney(
  left: Money, right: Money,
): Result<Money, CurrencyMismatchError | CurrencyCodeError> {
  return combineMoney(left, right, (a, b) => a + b);
}
export function subtractMoney(
  left: Money, right: Money,
): Result<Money, CurrencyMismatchError | CurrencyCodeError> {
  return combineMoney(left, right, (a, b) => a - b);
}
export function sumMoney(
  values: readonly Money[], currency: CurrencyCode,
): Result<Money, CurrencyMismatchError | CurrencyCodeError> {
  const validCurrency = createCurrencyCode(currency);
  if (!validCurrency.ok) return validCurrency;
  for (const value of values) {
    const valueCurrency = createCurrencyCode(value.currency);
    if (!valueCurrency.ok) return valueCurrency;
    if (valueCurrency.value !== validCurrency.value) return err(CURRENCY_MISMATCH);
  }
  let total = BigInt("0");
  for (const value of values) total += value.minorUnits;
  return ok(createMoney(total, validCurrency.value));
}
export function serializeMoney(value: Money): SerializedMoney {
  return { minorUnits: value.minorUnits.toString(), currency: value.currency };
}
export function deserializeMoney(
  payload: unknown,
): Result<Money, MoneyPayloadError | CurrencyCodeError> {
  if (typeof payload !== "object" || payload === null)
    return err({ code: "INVALID_MONEY_PAYLOAD", field: "payload" });
  let keys: (string | symbol)[];
  let descriptors: PropertyDescriptorMap;
  let prototype: object | null;
  try {
    if (Array.isArray(payload)) return err({ code: "INVALID_MONEY_PAYLOAD", field: "payload" });
    keys = Reflect.ownKeys(payload);
    descriptors = Object.getOwnPropertyDescriptors(payload);
    prototype = Object.getPrototypeOf(payload);
  } catch {
    return err({ code: "INVALID_MONEY_PAYLOAD", field: "payload" });
  }
  const minorUnitsProperty = descriptors.minorUnits;
  const currencyProperty = descriptors.currency;
  if (
    prototype !== Object.prototype || keys.length !== 2 ||
    !keys.every((key) => key === "minorUnits" || key === "currency") ||
    !minorUnitsProperty || !("value" in minorUnitsProperty) ||
    !currencyProperty || !("value" in currencyProperty)
  ) return err({ code: "INVALID_MONEY_PAYLOAD", field: "payload" });
  const minorUnits = minorUnitsProperty.value;
  if (
    typeof minorUnits !== "string" || !CANONICAL_MINOR_UNITS.test(minorUnits) ||
    minorUnits === "-0"
  ) return err({ code: "INVALID_MONEY_PAYLOAD", field: "minorUnits" });
  const currency = createCurrencyCode(currencyProperty.value);
  return currency.ok ? ok(createMoney(BigInt(minorUnits), currency.value)) : currency;
}
