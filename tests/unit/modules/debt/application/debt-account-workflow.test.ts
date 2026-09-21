import { describe, expect, it, vi } from "vitest";
import { createDebtAccount } from "@/modules/debt/application/debt-account-workflow";

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
