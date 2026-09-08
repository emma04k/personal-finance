import { describe, expect, expectTypeOf, it } from "vitest";
import {
  addMoney, createCurrencyCode, deserializeMoney, money, nonNegativeMoney,
  serializeMoney, subtractMoney, sumMoney, type CurrencyCode, type Money,
} from "@/modules/finance/domain/money";
const ZERO = BigInt("0");
const ONE = BigInt("1");
function currency(code: string): CurrencyCode {
  const result = createCurrencyCode(code);
  if (!result.ok) throw new Error("Synthetic test currency must be supported");
  return result.value;
}
function amount(minorUnits: bigint, code: CurrencyCode): Money {
  const result = money(minorUnits, code);
  if (!result.ok) throw new Error("Synthetic test amount must be valid");
  return result.value;
}
const validMoney = (minorUnits: bigint, code: CurrencyCode) => ({ ok: true, value: { minorUnits, currency: code } });
const invalidPayload = (field: "payload" | "minorUnits") => ({ ok: false, error: { code: "INVALID_MONEY_PAYLOAD", field } });
const mismatch = { ok: false, error: { code: "CURRENCY_MISMATCH", field: "currency" } };
describe("currency and Money construction", () => {
  it.each(["JPY", "USD", "COP", "KWD"])("accepts and brands pinned ISO currency %s", (code) => {
    const result = createCurrencyCode(code);
    expect(result).toEqual({ ok: true, value: code });
    if (result.ok) expectTypeOf(result.value).toEqualTypeOf<CurrencyCode>();
  });
  it("cannot be structurally assigned without factory validation", () => {
    expectTypeOf<{ minorUnits: bigint; currency: CurrencyCode }>().not.toMatchTypeOf<Money>();
  });
  it.each([
    ["usd", "INVALID_CURRENCY_CODE"], ["US", "INVALID_CURRENCY_CODE"],
    ["USDD", "INVALID_CURRENCY_CODE"], ["12A", "INVALID_CURRENCY_CODE"],
    ["ZZZ", "UNSUPPORTED_CURRENCY"], [" USD ", "INVALID_CURRENCY_CODE"],
    [null, "INVALID_CURRENCY_CODE"],
  ] as const)("rejects malformed or unsupported currency %p", (input, code) => {
    const result = createCurrencyCode(input);
    expect(result).toEqual({ ok: false, error: { code, field: "currency" } });
    expect(JSON.stringify(result)).not.toContain(String(input));
  });
  it("creates immutable signed Money with very large bigint minor units", () => {
    const usd = currency("USD");
    const veryLarge = BigInt("9007199254740993123456");
    const result = money(veryLarge, usd);
    expect(result).toEqual(validMoney(veryLarge, usd));
    if (result.ok) expect(Object.isFrozen(result.value)).toBe(true);
    expect(money(BigInt("-125"), usd)).toMatchObject({ ok: true });
  });
  it("accepts deliberate zero and rejects negative or null source amounts", () => {
    const cop = currency("COP");
    expect(nonNegativeMoney(ZERO, cop)).toEqual(validMoney(ZERO, cop));
    expect(nonNegativeMoney(-ONE, cop)).toEqual({
      ok: false, error: { code: "NEGATIVE_MONEY", field: "minorUnits" },
    });
    expect(nonNegativeMoney(null as never, cop)).toEqual({
      ok: false, error: { code: "INVALID_MINOR_UNITS", field: "minorUnits" },
    });
  });
  it("revalidates forged unsupported currency in every public constructor", () => {
    const forged = "ZZZ" as CurrencyCode;
    const unsupported = { ok: false, error: { code: "UNSUPPORTED_CURRENCY", field: "currency" } };
    expect(money(ZERO, forged)).toEqual(unsupported);
    expect(nonNegativeMoney(ZERO, forged)).toEqual(unsupported);
    const forgedMoney = { minorUnits: ZERO, currency: forged } as unknown as Money;
    expect(sumMoney([forgedMoney], currency("USD"))).toEqual(unsupported);
    expect(sumMoney([], forged)).toEqual(unsupported);
  });
});
describe("Money arithmetic", () => {
  it.each([
    [BigInt("7"), BigInt("5")], [BigInt("-7"), BigInt("5")],
    [BigInt("9007199254740993000000"), BigInt("44")],
  ])("adds, subtracts, and sums signed bigint amounts", (left, right) => {
    const usd = currency("USD");
    expect(addMoney(amount(left, usd), amount(right, usd))).toEqual(validMoney(left + right, usd));
    expect(subtractMoney(amount(left, usd), amount(right, usd))).toEqual(validMoney(left - right, usd));
    expect(sumMoney([amount(left, usd), amount(right, usd)], usd)).toEqual(validMoney(left + right, usd));
  });
  it.each([
    ["add", (matching: Money, other: Money) => addMoney(matching, other)],
    ["subtract", (matching: Money, other: Money) => subtractMoney(matching, other)],
    ["sum", (matching: Money, other: Money, expected: CurrencyCode) => sumMoney([matching, other], expected)],
  ] as const)("%s rejects mixed currencies before reading minor units", (_, combine) => {
    let reads = 0;
    const guarded = (code: CurrencyCode) => ({
      currency: code, get minorUnits() { reads += 1; return ONE; },
    }) as unknown as Money;
    const usd = currency("USD");
    expect(combine(guarded(usd), guarded(currency("COP")), usd)).toEqual(mismatch);
    expect(reads).toBe(0);
    expect(JSON.stringify(mismatch)).not.toContain(ONE.toString());
  });
  it("sums an empty collection to deliberate zero in the explicit currency", () => {
    const jpy = currency("JPY");
    expect(sumMoney([], jpy)).toEqual(validMoney(ZERO, jpy));
  });
});
describe("Money serialization", () => {
  it.each([
    BigInt("42"), ZERO, BigInt("-42"), BigInt("999999999999999999999999999999999999"),
  ])("round-trips %s minor units canonically", (minorUnits) => {
    const original = amount(minorUnits, currency("KWD"));
    const serialized = serializeMoney(original);
    expect(serialized).toEqual({ minorUnits: minorUnits.toString(), currency: "KWD" });
    expect(deserializeMoney(serialized)).toEqual({ ok: true, value: original });
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  });
  it.each(["", " 1", "1 ", "1.0", "1e3", "01", "-01", "+1", "-0"])(
    "rejects non-canonical minor units %p without exposing them", (minorUnits) => {
      const result = deserializeMoney({ minorUnits, currency: "USD" });
      expect(result).toEqual(invalidPayload("minorUnits"));
      expect(JSON.stringify(result)).not.toContain(minorUnits || "not-present");
    },
  );
  it("rejects payloads without exactly two own data properties", () => {
    let getterReads = 0;
    const accessor = (property: PropertyDescriptor) => Object.defineProperties({}, {
      minorUnits: { enumerable: true, ...property },
      currency: { enumerable: true, value: "USD" },
    });
    const hiddenExtra = { minorUnits: "0", currency: "USD" };
    Object.defineProperty(hiddenExtra, "extra", { value: true });
    for (const payload of [
      { minorUnits: "0", currency: "USD", [Symbol("extra")]: true }, hiddenExtra,
      accessor({ get: () => { getterReads += 1; return "0"; } }),
      accessor({ set: () => undefined }), Object.create({ minorUnits: "0", currency: "USD" }),
      [], { minorUnits: "0" }, { minorUnits: "0", currency: "USD", extra: true },
    ]) expect(deserializeMoney(payload)).toEqual(invalidPayload("payload"));
    expect(getterReads).toBe(0);
  });
  it("returns typed invalid payload for a revoked Proxy without throwing", () => {
    const { proxy, revoke } = Proxy.revocable({ minorUnits: "0", currency: "USD" }, {});
    revoke();

    expect(() => deserializeMoney(proxy)).not.toThrow();
    expect(deserializeMoney(proxy)).toEqual(invalidPayload("payload"));
  });

  it.each([
    ["ownKeys", { ownKeys: () => { throw new Error("hostile ownKeys trap"); } }],
    ["getOwnPropertyDescriptor", {
      getOwnPropertyDescriptor: () => { throw new Error("hostile descriptor trap"); },
    }],
    ["getPrototypeOf", { getPrototypeOf: () => { throw new Error("hostile prototype trap"); } }],
  ] as const)("returns typed invalid payload when a Proxy throws from %s", (_, handler) => {
    const payload = new Proxy({ minorUnits: "0", currency: "USD" }, handler);

    const result = deserializeMoney(payload);

    expect(result).toEqual(invalidPayload("payload"));
  });
  it("rejects invalid payload shapes, bigint transport values, and currencies", () => {
    expect(deserializeMoney(null)).toEqual(invalidPayload("payload"));
    expect(deserializeMoney({ minorUnits: ZERO, currency: "USD" })).toEqual(
      invalidPayload("minorUnits"),
    );
    expect(deserializeMoney({ minorUnits: "0", currency: "ZZZ" })).toEqual({
      ok: false, error: { code: "UNSUPPORTED_CURRENCY", field: "currency" },
    });
  });
});
