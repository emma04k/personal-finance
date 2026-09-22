import { describe, expect, it, vi } from "vitest";
import { createDebtAccount, updateDebtAccount } from "@/modules/debt/application/debt-account-workflow";
import type { OwnedDebtAccount } from "@/modules/debt/application/owned-debt-account-repository";

const owner = {
  userId: "00000000-0000-0000-0000-000000000001",
  role: "OWNER" as const,
  email: "owner@example.com",
};

function repository() {
  return {
    createDebtAccountForOwner: vi.fn(async (ownerUserId: string, input) => ({
      id: "10000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      name: input.name,
      creditorName: input.creditorName,
      currentBalanceMinor: input.currentBalanceMinor,
      defaultRequiredPaymentMinor: input.defaultRequiredPaymentMinor,
      currencyCode: input.currencyCode,
      status: "ACTIVE" as const,
    })),
    updateDebtAccountForOwner: vi.fn(async (ownerUserId: string, debtAccountId: string, input): Promise<OwnedDebtAccount | null> => ({
      id: debtAccountId,
      userId: ownerUserId,
      name: input.name,
      creditorName: input.creditorName,
      currentBalanceMinor: input.currentBalanceMinor,
      defaultRequiredPaymentMinor: input.defaultRequiredPaymentMinor,
      currencyCode: input.currencyCode,
      status: "ACTIVE" as const,
    })),
  };
}

describe("debt account creation workflow", () => {
  it("creates an active owner-scoped debt account with exact minor-unit money parsing", async () => {
    const repo = repository();

    const result = await createDebtAccount({
      owner,
      repository: repo,
      input: {
        name: " Student loan ",
        creditorName: " Federal Servicer ",
        currentBalance: "12500.75",
        defaultRequiredPayment: "150.25",
        currencyCode: "USD",
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        account: {
          id: "10000000-0000-0000-0000-000000000001",
          userId: owner.userId,
          name: "Student loan",
          creditorName: "Federal Servicer",
          currentBalanceMinor: "1250075",
          defaultRequiredPaymentMinor: "15025",
          currencyCode: "USD",
          status: "ACTIVE",
        },
      },
    });
    expect(repo.createDebtAccountForOwner).toHaveBeenCalledWith(owner.userId, {
      name: "Student loan",
      creditorName: "Federal Servicer",
      currentBalanceMinor: "1250075",
      defaultRequiredPaymentMinor: "15025",
      currencyCode: "USD",
    });
  });

  it.each([
    ["name", { name: "   " }, "ACCOUNT_NAME_REQUIRED"],
    ["name", { name: "x".repeat(121) }, "ACCOUNT_NAME_TOO_LONG"],
    ["creditorName", { creditorName: "x".repeat(121) }, "CREDITOR_NAME_TOO_LONG"],
    ["currencyCode", { currencyCode: "EURO" }, "INVALID_CURRENCY_CODE"],
    ["currencyCode", { currencyCode: "EUR" }, "UNSUPPORTED_CURRENCY"],
    ["currentBalance", { currentBalance: "001" }, "INVALID_CURRENT_BALANCE"],
    ["currentBalance", { currentBalance: "-1.00" }, "INVALID_CURRENT_BALANCE"],
    ["defaultRequiredPayment", { defaultRequiredPayment: "10.001" }, "INVALID_REQUIRED_PAYMENT"],
  ] as const)("returns %s validation error %s before persistence", async (field, overrides, code) => {
    const repo = repository();

    const result = await createDebtAccount({
      owner,
      repository: repo,
      input: {
        name: "Student loan",
        creditorName: "Federal Servicer",
        currentBalance: "12500.75",
        defaultRequiredPayment: "150.25",
        currencyCode: "USD",
        ...overrides,
      },
    });

    expect(result).toEqual({ ok: false, error: { code, field } });
    expect(repo.createDebtAccountForOwner).not.toHaveBeenCalled();
  });

  it("accepts zero and currency-specific decimal exponents without floating-point rounding", async () => {
    const repo = repository();

    const result = await createDebtAccount({
      owner,
      repository: repo,
      input: {
        name: "Installment plan",
        creditorName: "",
        currentBalance: "90071992547409.93",
        defaultRequiredPayment: "0",
        currencyCode: "USD",
      },
    });

    expect(result.ok).toBe(true);
    expect(repo.createDebtAccountForOwner).toHaveBeenCalledWith(owner.userId, expect.objectContaining({
      creditorName: null,
      currentBalanceMinor: "9007199254740993",
      defaultRequiredPaymentMinor: "0",
    }));
  });
});

describe("debt account update workflow", () => {
  it("updates an owner-scoped active debt account with exact minor-unit money parsing", async () => {
    const repo = repository();

    const result = await updateDebtAccount({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000001",
        name: " Updated student loan ",
        creditorName: " ",
        currentBalance: "0.50",
        defaultRequiredPayment: "0.00",
        currencyCode: "USD",
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        account: {
          id: "10000000-0000-0000-0000-000000000001",
          userId: owner.userId,
          name: "Updated student loan",
          creditorName: null,
          currentBalanceMinor: "50",
          defaultRequiredPaymentMinor: "0",
          currencyCode: "USD",
          status: "ACTIVE",
        },
      },
    });
    expect(repo.updateDebtAccountForOwner).toHaveBeenCalledWith(owner.userId, "10000000-0000-0000-0000-000000000001", {
      name: "Updated student loan",
      creditorName: null,
      currentBalanceMinor: "50",
      defaultRequiredPaymentMinor: "0",
      currencyCode: "USD",
    });
  });

  it.each([
    ["debtAccountId", { debtAccountId: "   " }, "DEBT_ACCOUNT_ID_REQUIRED"],
    ["debtAccountId", { debtAccountId: "not-a-uuid" }, "INVALID_DEBT_ACCOUNT_ID"],
    ["name", { name: "   " }, "ACCOUNT_NAME_REQUIRED"],
    ["currencyCode", { currencyCode: "EURO" }, "INVALID_CURRENCY_CODE"],
    ["currentBalance", { currentBalance: "001" }, "INVALID_CURRENT_BALANCE"],
    ["defaultRequiredPayment", { defaultRequiredPayment: "10.001" }, "INVALID_REQUIRED_PAYMENT"],
  ] as const)("returns %s validation error %s before update persistence", async (field, overrides, code) => {
    const repo = repository();

    const result = await updateDebtAccount({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000001",
        name: "Student loan",
        creditorName: "Federal Servicer",
        currentBalance: "12500.75",
        defaultRequiredPayment: "150.25",
        currencyCode: "USD",
        ...overrides,
      },
    });

    expect(result).toEqual({ ok: false, error: { code, field } });
    expect(repo.updateDebtAccountForOwner).not.toHaveBeenCalled();
  });

  it("returns a safe not-found error when the account is missing or belongs to another owner", async () => {
    const repo = repository();
    repo.updateDebtAccountForOwner.mockResolvedValueOnce(null);

    const result = await updateDebtAccount({
      owner,
      repository: repo,
      input: {
        debtAccountId: "10000000-0000-0000-0000-000000000999",
        name: "Student loan",
        creditorName: "Federal Servicer",
        currentBalance: "12500.75",
        defaultRequiredPayment: "150.25",
        currencyCode: "USD",
      },
    });

    expect(result).toEqual({ ok: false, error: { code: "DEBT_ACCOUNT_NOT_FOUND", field: "debtAccountId" } });
  });
});
