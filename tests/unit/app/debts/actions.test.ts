import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationRequiredError, UserNotActiveError } from "@/modules/auth/application/ownership-context";

const mocks = vi.hoisted(() => {
  const owner = {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "OWNER" as const,
    email: "owner@example.com",
  };
  const createDebtAccountForOwner = vi.fn(async (ownerUserId: string, input) => ({
    id: "10000000-0000-0000-0000-000000000001",
    userId: ownerUserId,
    name: input.name,
    creditorName: input.creditorName,
    currentBalanceMinor: input.currentBalanceMinor,
    defaultRequiredPaymentMinor: input.defaultRequiredPaymentMinor,
    currencyCode: input.currencyCode,
    status: "ACTIVE" as const,
  }));
  return {
    owner,
    repository: { createDebtAccountForOwner },
    createDebtAccountForOwner,
    requireCurrentOwnershipContext: vi.fn(async () => owner),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/modules/auth/application/current-ownership-context", () => ({
  requireCurrentOwnershipContext: mocks.requireCurrentOwnershipContext,
}));

vi.mock("@/modules/debt/infrastructure/prisma-owned-debt-account-repository", () => ({
  PrismaOwnedDebtAccountRepository: vi.fn(function PrismaOwnedDebtAccountRepository() {
    return mocks.repository;
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { createDebtAccountAction } from "@/app/debts/actions";
import { initialDebtAccountActionState } from "@/app/debts/debt-account-action-state";

function debtAccountForm(overrides: Partial<Record<"name" | "creditorName" | "currentBalance" | "defaultRequiredPayment" | "currencyCode" | "userId", string>> = {}) {
  const formData = new FormData();
  formData.set("name", overrides.name ?? "Student loan");
  if (overrides.creditorName !== undefined) formData.set("creditorName", overrides.creditorName);
  else formData.set("creditorName", "Federal Servicer");
  formData.set("currentBalance", overrides.currentBalance ?? "12500.75");
  formData.set("defaultRequiredPayment", overrides.defaultRequiredPayment ?? "150.25");
  formData.set("currencyCode", overrides.currencyCode ?? "USD");
  if (overrides.userId !== undefined) formData.set("userId", overrides.userId);
  return formData;
}

describe("debt account server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentOwnershipContext.mockResolvedValue(mocks.owner);
    mocks.createDebtAccountForOwner.mockImplementation(async (ownerUserId: string, input) => ({
      id: "10000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      name: input.name,
      creditorName: input.creditorName,
      currentBalanceMinor: input.currentBalanceMinor,
      defaultRequiredPaymentMinor: input.defaultRequiredPaymentMinor,
      currencyCode: input.currencyCode,
      status: "ACTIVE" as const,
    }));
  });

  it("creates debt accounts from authenticated owner context without accepting client owner ids", async () => {
    const result = await createDebtAccountAction(
      initialDebtAccountActionState,
      debtAccountForm({ userId: "00000000-0000-0000-0000-000000000999" }),
    );

    expect(result).toEqual({
      status: "success",
      message: "Debt account created.",
      fieldErrors: {},
    });
    expect(mocks.createDebtAccountForOwner).toHaveBeenCalledWith(mocks.owner.userId, {
      name: "Student loan",
      creditorName: "Federal Servicer",
      currentBalanceMinor: "1250075",
      defaultRequiredPaymentMinor: "15025",
      currencyCode: "USD",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/debts");
  });

  it.each([
    ["name", { name: "   " }, "Enter an account name."],
    ["currentBalance", { currentBalance: "001" }, "Enter a valid current balance for the selected currency."],
    ["defaultRequiredPayment", { defaultRequiredPayment: "10.001" }, "Enter a valid required monthly payment for the selected currency."],
    ["currencyCode", { currencyCode: "EUR" }, "Select a supported currency."],
  ] as const)("returns safe validation feedback for %s", async (field, overrides, message) => {
    const result = await createDebtAccountAction(
      initialDebtAccountActionState,
      debtAccountForm(overrides),
    );

    expect(result).toEqual({
      status: "error",
      message,
      fieldErrors: { [field]: message },
    });
    expect(mocks.createDebtAccountForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    [new AuthenticationRequiredError()],
    [new UserNotActiveError()],
  ])("fails closed before persistence when active owner context is unavailable", async (authError) => {
    mocks.requireCurrentOwnershipContext.mockRejectedValueOnce(authError);

    const result = await createDebtAccountAction(initialDebtAccountActionState, debtAccountForm());

    expect(result).toEqual({
      status: "error",
      message: "Sign in with an active account to create debt accounts.",
      fieldErrors: {},
    });
    expect(mocks.createDebtAccountForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
