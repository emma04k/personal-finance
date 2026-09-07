import { err, ok, type Result } from "./result";
declare const exactRatioBrand: unique symbol;
export interface ExactRatio {
  readonly [exactRatioBrand]: "ExactRatio";
  readonly numerator: bigint;
  readonly denominator: bigint;
}
export type InvalidRatioError = Readonly<{
  code: "INVALID_RATIO";
  field: "numerator" | "denominator";
  reason: "not_bigint" | "negative" | "not_positive";
}>;
function invalidRatio(
  field: InvalidRatioError["field"], reason: InvalidRatioError["reason"],
): Result<never, InvalidRatioError> {
  return err({ code: "INVALID_RATIO", field, reason });
}
export function createRatio(
  numerator: bigint, denominator: bigint,
): Result<ExactRatio, InvalidRatioError> {
  if (typeof numerator !== "bigint") return invalidRatio("numerator", "not_bigint");
  if (numerator < BigInt("0")) return invalidRatio("numerator", "negative");
  if (typeof denominator !== "bigint") return invalidRatio("denominator", "not_bigint");
  if (denominator <= BigInt("0")) return invalidRatio("denominator", "not_positive");
  return ok(Object.freeze({ numerator, denominator }) as ExactRatio);
}
export const MAX_PERCENTAGE_FRACTION_DIGITS = 6;
export type FractionalDigitsError = Readonly<{
  code: "INVALID_FRACTION_DIGITS";
  field: "fractionalDigits";
  max: typeof MAX_PERCENTAGE_FRACTION_DIGITS;
}>;
const DECIMAL_SCALES = ["1", "10", "100", "1000", "10000", "100000", "1000000"].map(BigInt);
export function formatPercentage(
  ratio: ExactRatio, fractionalDigits: number,
): Result<string, FractionalDigitsError> {
  if (
    !Number.isInteger(fractionalDigits) || fractionalDigits < 0 ||
    fractionalDigits > MAX_PERCENTAGE_FRACTION_DIGITS
  ) {
    return err({
      code: "INVALID_FRACTION_DIGITS", field: "fractionalDigits",
      max: MAX_PERCENTAGE_FRACTION_DIGITS,
    });
  }
  const scale = DECIMAL_SCALES[fractionalDigits];
  const dividend = ratio.numerator * BigInt("100") * scale;
  const quotient = dividend / ratio.denominator;
  const roundsUp = (dividend % ratio.denominator) * BigInt("2") >= ratio.denominator;
  const rounded = quotient + (roundsUp ? BigInt("1") : BigInt("0"));
  if (fractionalDigits === 0) return ok(rounded.toString());
  const whole = rounded / scale;
  const fraction = (rounded % scale).toString().padStart(fractionalDigits, "0");
  return ok(`${whole}.${fraction}`);
}
