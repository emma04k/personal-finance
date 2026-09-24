import { describe, expect, it, vi } from "vitest";
import { recordDebtPayment } from "@/modules/debt/application/debt-payment-workflow";
import type {
  OwnedDebtPaymentAccount,
  OwnedDebtPaymentPeriod,
} from "@/modules/debt/application/owned-debt-payment-repository";
import { DuplicateDebtPaymentError } from "@/modules/debt/application/owned-debt-payment-repository";

const owner = {
  userId: "00000000-0000-0000-0000-000000000001",
  role: "OWNER" as const,
  email: "owner@example.com",
};

function repository() {
  return {
    findActiveDebtAccountForOwner: vi.fn(async (ownerUserId: string, debtAccountId: string): Promise<OwnedDebtPaymentAccount | null> => ({
      id: debtAccountId,
      userId: ownerUserId,
      currencyCode: "USD",
      status: "ACTIVE" as const,
    })),
    findPeriodForOwner: vi.fn(async (ownerUserId: string, periodId: string): Promise<OwnedDebtPaymentPeriod | null> => ({
      id: periodId,
      userId: ownerUserId,
      currencyCode: "USD",
    })),
    createDebtPaymentForOwner: vi.fn(async (ownerUserId: string, input) => ({
      id: "20000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      periodId: input.periodId,
      debtAccountId: input.debtAccountId,
      amountMinor: input.amountMinor,
      currencyCode: input.currencyCode,
      paidOn: input.paidOn,
      requiredPaymentOverrideMinor: input.requiredPaymentOverrideMinor,
      notes: input.notes,
    })),
  };
}

describe("debt payment recording workflow", () => {
  it("records an owner-scoped payment for an active debt account and owned period with exact minor-unit money parsing", async () => {
    const repo = repository();

    const result = await recordDebtPayment({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000001",
        periodId: "30000000-0000-0000-0000-000000000001",
        amount: "90071992547409.93",
        paidOn: "2026-09-15",
        requiredPaymentOverride: "0.50",
        notes: "  First tracked payment  ",
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        payment: {
          id: "20000000-0000-0000-0000-000000000001",
          userId: owner.userId,
          periodId: "30000000-0000-0000-0000-000000000001",
          debtAccountId: "10000000-0000-0000-0000-000000000001",
          amountMinor: "9007199254740993",
          currencyCode: "USD",
          paidOn: "2026-09-15",
          requiredPaymentOverrideMinor: "50",
          notes: "First tracked payment",
        },
      },
    });
    expect(repo.findActiveDebtAccountForOwner).toHaveBeenCalledWith(owner.userId, "10000000-0000-0000-0000-000000000001");
    expect(repo.findPeriodForOwner).toHaveBeenCalledWith(owner.userId, "30000000-0000-0000-0000-000000000001");
    expect(repo.createDebtPaymentForOwner).toHaveBeenCalledWith(owner.userId, {
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      periodId: "30000000-0000-0000-0000-000000000001",
      amountMinor: "9007199254740993",
      currencyCode: "USD",
      paidOn: "2026-09-15",
      requiredPaymentOverrideMinor: "50",
      notes: "First tracked payment",
    });
  });

  it.each([
    ["debtAccountId", { debtAccountId: "   " }, "DEBT_ACCOUNT_ID_REQUIRED"],
    ["debtAccountId", { debtAccountId: "not-a-uuid" }, "INVALID_DEBT_ACCOUNT_ID"],
    ["periodId", { periodId: "   " }, "PERIOD_ID_REQUIRED"],
    ["periodId", { periodId: "not-a-uuid" }, "INVALID_PERIOD_ID"],
  ] as const)("rejects malformed %s before persistence lookup", async (field, overrides, code) => {
    const repo = repository();

    const result = await recordDebtPayment({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000001",
        periodId: "30000000-0000-0000-0000-000000000001",
        amount: "150.25",
        paidOn: "2026-09-15",
        requiredPaymentOverride: "",
        notes: null,
        ...overrides,
      },
    });

    expect(result).toEqual({ ok: false, error: { code, field } });
    expect(repo.findActiveDebtAccountForOwner).not.toHaveBeenCalled();
    expect(repo.findPeriodForOwner).not.toHaveBeenCalled();
    expect(repo.createDebtPaymentForOwner).not.toHaveBeenCalled();
  });

  it("returns a safe error when the debt account is missing, not owned, or inactive", async () => {
    const repo = repository();
    repo.findActiveDebtAccountForOwner.mockResolvedValueOnce(null);

    const result = await recordDebtPayment({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000999",
        periodId: "30000000-0000-0000-0000-000000000001",
        amount: "150.25",
        paidOn: "2026-09-15",
        requiredPaymentOverride: "",
        notes: null,
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "DEBT_ACCOUNT_NOT_FOUND", field: "debtAccountId" } });
    expect(repo.findPeriodForOwner).not.toHaveBeenCalled();
    expect(repo.createDebtPaymentForOwner).not.toHaveBeenCalled();
  });

  it("returns a safe error when the monthly period is missing or belongs to another owner", async () => {
    const repo = repository();
    repo.findPeriodForOwner.mockResolvedValueOnce(null);

    const result = await recordDebtPayment({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000001",
        periodId: "30000000-0000-0000-0000-000000000999",
        amount: "150.25",
        paidOn: "2026-09-15",
        requiredPaymentOverride: "",
        notes: null,
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "PERIOD_NOT_FOUND", field: "periodId" } });
    expect(repo.createDebtPaymentForOwner).not.toHaveBeenCalled();
  });

  it("returns a safe error when a payment already exists for the account and period", async () => {
    const repo = repository();
    repo.createDebtPaymentForOwner.mockRejectedValueOnce(new DuplicateDebtPaymentError());

    const result = await recordDebtPayment({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000001",
        periodId: "30000000-0000-0000-0000-000000000001",
        amount: "150.25",
        paidOn: "2026-09-15",
        requiredPaymentOverride: "",
        notes: null,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "DEBT_PAYMENT_ALREADY_RECORDED", field: "periodId" },
    });
  });

  it("rejects mixed account and period currencies before recording payment data", async () => {
    const repo = repository();
    repo.findPeriodForOwner.mockResolvedValueOnce({
      id: "30000000-0000-0000-0000-000000000001",
      userId: owner.userId,
      currencyCode: "EUR",
    });

    const result = await recordDebtPayment({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000001",
        periodId: "30000000-0000-0000-0000-000000000001",
        amount: "150.25",
        paidOn: "2026-09-15",
        requiredPaymentOverride: "",
        notes: null,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "CURRENCY_MISMATCH", field: "periodId" },
    });
    expect(repo.createDebtPaymentForOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["amount", { amount: "10.001" }, "INVALID_PAYMENT_AMOUNT"],
    ["paidOn", { paidOn: "" }, "PAID_ON_REQUIRED"],
    ["paidOn", { paidOn: "2026-02-30" }, "INVALID_PAID_ON"],
    ["requiredPaymentOverride", { requiredPaymentOverride: "0.001" }, "INVALID_REQUIRED_PAYMENT_OVERRIDE"],
    ["notes", { notes: "x".repeat(501) }, "NOTES_TOO_LONG"],
  ] as const)("returns %s validation error %s before creating a payment", async (field, overrides, code) => {
    const repo = repository();

    const result = await recordDebtPayment({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000001",
        periodId: "30000000-0000-0000-0000-000000000001",
        amount: "150.25",
        paidOn: "2026-09-15",
        requiredPaymentOverride: "",
        notes: null,
        ...overrides,
      },
    });

    expect(result).toEqual({ ok: false, error: { code, field } });
    expect(repo.createDebtPaymentForOwner).not.toHaveBeenCalled();
  });
});
