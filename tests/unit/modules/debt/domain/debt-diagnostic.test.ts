import { describe, expect, it } from "vitest";
import {
  createCurrencyCode,
  money as signedMoney,
  nonNegativeMoney,
  type CurrencyCode,
  type Money,
} from "@/modules/finance/domain/money";
import { diagnoseDebt } from "@/modules/debt/domain/debt-diagnostic";

function currency(code = "USD"): CurrencyCode {
  const result = createCurrencyCode(code);
  if (!result.ok) throw new Error("Synthetic test currency must be supported");
  return result.value;
}

const units = (value: string) => BigInt(value);

function amount(minorUnits: bigint, code = currency()): Money {
  const result = nonNegativeMoney(minorUnits, code);
  if (!result.ok) throw new Error("Synthetic test amount must be valid");
  return result.value;
}

function signedAmount(minorUnits: bigint, code = currency()): Money {
  const result = signedMoney(minorUnits, code);
  if (!result.ok) throw new Error("Synthetic test amount must be valid");
  return result.value;
}

describe("debt diagnostic", () => {
  it("classifies exact debt-to-income boundaries using unrounded integer ratios", () => {
    const usd = currency();

    expect(diagnoseDebt({ currency: usd, monthlyIncome: amount(units("10000"), usd), debtPayments: [{ id: "p", amount: amount(units("3000"), usd) }] })).toMatchObject({
      ok: true,
      value: { debtBand: { available: true, band: "stable" }, saferBandMonthlyReduction: { available: true, value: { minorUnits: units("0"), currency: usd } } },
    });
    expect(diagnoseDebt({ currency: usd, monthlyIncome: amount(units("10000"), usd), debtPayments: [{ id: "p", amount: amount(units("3001"), usd) }] })).toMatchObject({
      ok: true,
      value: { debtBand: { available: true, band: "watch" }, saferBandMonthlyReduction: { available: true, value: { minorUnits: units("1"), currency: usd } } },
    });
    expect(diagnoseDebt({ currency: usd, monthlyIncome: amount(units("10000"), usd), debtPayments: [{ id: "p", amount: amount(units("4001"), usd) }] })).toMatchObject({
      ok: true,
      value: { debtBand: { available: true, band: "strained" }, saferBandMonthlyReduction: { available: true, value: { minorUnits: units("1"), currency: usd } } },
    });
    expect(diagnoseDebt({ currency: usd, monthlyIncome: amount(units("10000"), usd), debtPayments: [{ id: "p", amount: amount(units("6001"), usd) }] })).toMatchObject({
      ok: true,
      value: { debtBand: { available: true, band: "critical" }, saferBandMonthlyReduction: { available: true, value: { minorUnits: units("1"), currency: usd } } },
    });
  });

  it("marks debt rates, bands, and reductions unavailable for missing or zero income", () => {
    const usd = currency();

    expect(diagnoseDebt({
      currency: usd,
      monthlyIncome: null,
      debtPayments: [{ id: "p", amount: amount(units("1"), usd) }],
    })).toMatchObject({
      ok: true,
      value: {
        debtToIncomeRate: { available: false, reason: "INCOME_MISSING" },
        debtBand: { available: false, reason: "INCOME_MISSING" },
        saferBandMonthlyReduction: { available: false, reason: "INCOME_MISSING" },
      },
    });

    expect(diagnoseDebt({
      currency: usd,
      monthlyIncome: amount(units("0"), usd),
      debtPayments: [{ id: "p", amount: amount(units("1"), usd) }],
    })).toMatchObject({
      ok: true,
      value: {
        debtToIncomeRate: { available: false, reason: "ZERO_INCOME" },
        debtBand: { available: false, reason: "ZERO_INCOME" },
        saferBandMonthlyReduction: { available: false, reason: "ZERO_INCOME" },
      },
    });
  });

  it("prevents double-counting linked debt payments and rejects unsafe links", () => {
    const usd = currency();

    expect(diagnoseDebt({
      currency: usd,
      monthlyIncome: amount(units("1000"), usd),
      debtPayments: [
        { id: "payment", amount: amount(units("100"), usd), linkedTransactionId: "tx-linked" },
      ],
      transactions: [
        { id: "tx-linked", amount: amount(units("100"), usd) },
        { id: "tx-unlinked", amount: amount(units("50"), usd) },
      ],
    })).toMatchObject({
      ok: true,
      value: {
        monthlyDebtPayments: { minorUnits: units("150"), currency: usd },
        debtToIncomeRate: { available: true, ratio: { numerator: units("150"), denominator: units("1000") } },
      },
    });

    expect(diagnoseDebt({
      currency: usd,
      monthlyIncome: amount(units("1000"), usd),
      debtPayments: [
        { id: "first", amount: amount(units("100"), usd), linkedTransactionId: "tx-linked" },
        { id: "second", amount: amount(units("100"), usd), linkedTransactionId: "tx-linked" },
      ],
      transactions: [{ id: "tx-linked", amount: amount(units("100"), usd) }],
    })).toEqual({ ok: false, error: { code: "INVALID_DEBT_LINK", field: "linkedTransactionId" } });

    expect(diagnoseDebt({
      currency: usd,
      monthlyIncome: amount(units("1000"), usd),
      debtPayments: [
        { id: "payment", amount: amount(units("100"), usd), linkedTransactionId: "tx-linked" },
      ],
      transactions: [{ id: "tx-linked", amount: amount(units("101"), usd) }],
    })).toEqual({ ok: false, error: { code: "INVALID_DEBT_LINK", field: "linkedTransactionId" } });
  });

  it("rejects signed negative debt payments as invalid source cash outflow", () => {
    const usd = currency();

    expect(diagnoseDebt({
      currency: usd,
      monthlyIncome: amount(units("100"), usd),
      debtPayments: [{ id: "p", amount: signedAmount(-units("1"), usd) }],
    })).toEqual({ ok: false, error: { code: "NEGATIVE_DEBT_PAYMENT", field: "amount" } });
  });

  it("rejects signed negative debt transactions as invalid source cash outflow", () => {
    const usd = currency();

    expect(diagnoseDebt({
      currency: usd,
      monthlyIncome: amount(units("100"), usd),
      debtPayments: [],
      transactions: [{ id: "t", amount: signedAmount(-units("1"), usd) }],
    })).toEqual({ ok: false, error: { code: "NEGATIVE_DEBT_PAYMENT", field: "amount" } });
  });

  it("rejects signed negative monthly income instead of classifying with an invalid denominator", () => {
    const usd = currency();

    expect(diagnoseDebt({
      currency: usd,
      monthlyIncome: signedAmount(-units("1"), usd),
      debtPayments: [{ id: "p", amount: amount(units("1"), usd) }],
    })).toEqual({ ok: false, error: { code: "NEGATIVE_DEBT_INCOME", field: "monthlyIncome" } });
  });
});
