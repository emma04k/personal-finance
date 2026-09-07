import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createRatio, formatPercentage, MAX_PERCENTAGE_FRACTION_DIGITS,
  type ExactRatio,
} from "@/modules/finance/domain/ratio";

const ZERO = BigInt("0");
const ONE = BigInt("1");
function ratio(numerator: bigint, denominator: bigint): ExactRatio {
  const result = createRatio(numerator, denominator);
  if (!result.ok) throw new Error("Synthetic test ratio must be valid");
  return result.value;
}
describe("ExactRatio construction", () => {
  it("cannot be structurally constructed without validation", () => {
    expectTypeOf<{ numerator: bigint; denominator: bigint }>().not.toMatchTypeOf<ExactRatio>();
  });
  it("preserves very large bigint operands in an immutable ratio", () => {
    const numerator = BigInt("900719925474099312345678901234567890");
    const denominator = BigInt("900719925474099312345678901234567891");
    const result = createRatio(numerator, denominator);
    expect(result).toEqual({ ok: true, value: { numerator, denominator } });
    if (result.ok) expect(Object.isFrozen(result.value)).toBe(true);
  });
  it("accepts a deliberate zero numerator", () => {
    expect(createRatio(ZERO, ONE)).toEqual({
      ok: true, value: { numerator: ZERO, denominator: ONE },
    });
  });
  it.each([
    [BigInt("-1"), ONE, "numerator", "negative"],
    [ZERO, ZERO, "denominator", "not_positive"],
    [ZERO, BigInt("-1"), "denominator", "not_positive"],
    [null as never, ONE, "numerator", "not_bigint"],
    [ZERO, null as never, "denominator", "not_bigint"],
  ] as const)("rejects invalid operands with a safe typed %s error", (...sample) => {
    const [numerator, denominator, field, reason] = sample;
    expect(createRatio(numerator, denominator)).toEqual({
      ok: false, error: { code: "INVALID_RATIO", field, reason },
    });
  });
});

describe("percentage formatting", () => {
  it.each([
    [ONE, BigInt("8"), 2, "12.50"],
    [ONE, BigInt("200"), 0, "1"],
    [BigInt("499"), BigInt("100000"), 0, "0"],
    [BigInt("2469"), BigInt("20000"), 2, "12.35"],
    [ONE, BigInt("3"), 6, "33.333333"],
    [BigInt("199999999"), BigInt("200000000"), 6, "100.000000"],
    [ZERO, ONE, 3, "0.000"],
  ] as const)(
    "formats %s/%s at %s digits using integer half-up rounding",
    (numerator, denominator, digits, expected) => {
      expect(formatPercentage(ratio(numerator, denominator), digits)).toEqual({
        ok: true, value: expected,
      });
    },
  );

  it("formats very large ratios without losing bigint precision", () => {
    const numerator = BigInt("12345678901234567890123456789");
    expect(formatPercentage(ratio(numerator, BigInt("100")), 2)).toEqual({
      ok: true, value: "12345678901234567890123456789.00",
    });
  });
  it.each([-1, 1.5, 7, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects out-of-range fractional digits %s",
    (digits) => {
      expect(MAX_PERCENTAGE_FRACTION_DIGITS).toBe(6);
      expect(formatPercentage(ratio(ONE, ONE), digits)).toEqual({
        ok: false,
        error: {
          code: "INVALID_FRACTION_DIGITS", field: "fractionalDigits",
          max: MAX_PERCENTAGE_FRACTION_DIGITS,
        },
      });
    },
  );
});
