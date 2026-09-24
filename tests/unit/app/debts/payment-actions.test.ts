import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationRequiredError, UserNotActiveError } from "@/modules/auth/application/ownership-context";
import type {
  CreateDebtPaymentForOwnerInput,
  OwnedDebtPayment,
  OwnedDebtPaymentAccount,
  OwnedDebtPaymentPeriod,
} from "@/modules/debt/application/owned-debt-payment-repository";
import { DuplicateDebtPaymentError } from "@/modules/debt/application/owned-debt-payment-repository";

const mocks = vi.hoisted(() => {
  const owner = {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "OWNER" as const,
    email: "owner@example.com",
  };
  const findActiveDebtAccountForOwner = vi.fn(async (ownerUserId: string, debtAccountId: string): Promise<OwnedDebtPaymentAccount | null> => ({
    id: debtAccountId,
    userId: ownerUserId,
    currencyCode: "USD",
    status: "ACTIVE" as const,
  }));
  const findPeriodForOwner = vi.fn(async (ownerUserId: string, periodId: string): Promise<OwnedDebtPaymentPeriod | null> => ({
    id: periodId,
    userId: ownerUserId,
    currencyCode: "USD",
  }));
  const createDebtPaymentForOwner = vi.fn(async (
    ownerUserId: string,
    input: CreateDebtPaymentForOwnerInput,
  ): Promise<OwnedDebtPayment> => ({
    id: "20000000-0000-0000-0000-000000000001",
    userId: ownerUserId,
    ...input,
  }));
  return {
    owner,
    repository: { findActiveDebtAccountForOwner, findPeriodForOwner, createDebtPaymentForOwner },
    findActiveDebtAccountForOwner,
    findPeriodForOwner,
    createDebtPaymentForOwner,
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

vi.mock("@/modules/debt/infrastructure/prisma-owned-debt-payment-repository", () => ({
  PrismaOwnedDebtPaymentRepository: vi.fn(function PrismaOwnedDebtPaymentRepository() {
    return mocks.repository;
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { recordDebtPaymentAction } from "@/app/debts/actions";
import { initialDebtPaymentActionState } from "@/app/debts/debt-payment-action-state";

function paymentForm(overrides: Partial<Record<"debtAccountId" | "periodId" | "amount" | "paidOn" | "requiredPaymentOverride" | "notes" | "userId", string>> = {}) {
  const formData = new FormData();
  formData.set("debtAccountId", overrides.debtAccountId ?? "10000000-0000-0000-0000-000000000001");
  formData.set("periodId", overrides.periodId ?? "30000000-0000-0000-0000-000000000001");
  formData.set("amount", overrides.amount ?? "150.25");
  formData.set("paidOn", overrides.paidOn ?? "2026-09-15");
  if (overrides.requiredPaymentOverride !== undefined) {
    formData.set("requiredPaymentOverride", overrides.requiredPaymentOverride);
  }
  if (overrides.notes !== undefined) formData.set("notes", overrides.notes);
  if (overrides.userId !== undefined) formData.set("userId", overrides.userId);
  return formData;
}

describe("debt payment server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentOwnershipContext.mockResolvedValue(mocks.owner);
    mocks.findActiveDebtAccountForOwner.mockImplementation(async (ownerUserId: string, debtAccountId: string): Promise<OwnedDebtPaymentAccount | null> => ({
      id: debtAccountId,
      userId: ownerUserId,
      currencyCode: "USD",
      status: "ACTIVE" as const,
    }));
    mocks.findPeriodForOwner.mockImplementation(async (ownerUserId: string, periodId: string): Promise<OwnedDebtPaymentPeriod | null> => ({
      id: periodId,
      userId: ownerUserId,
      currencyCode: "USD",
    }));
    mocks.createDebtPaymentForOwner.mockImplementation(async (ownerUserId: string, input: CreateDebtPaymentForOwnerInput) => ({
      id: "20000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      ...input,
    }));
  });

  it("records debt payments from authenticated owner context without accepting client owner ids", async () => {
    const result = await recordDebtPaymentAction(
      initialDebtPaymentActionState,
      paymentForm({ userId: "00000000-0000-0000-0000-000000000999", requiredPaymentOverride: "175.00", notes: " September payment " }),
    );

    expect(result).toEqual({
      status: "success",
      message: "Debt payment recorded.",
      fieldErrors: {},
    });
    expect(mocks.createDebtPaymentForOwner).toHaveBeenCalledWith(mocks.owner.userId, {
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      periodId: "30000000-0000-0000-0000-000000000001",
      amountMinor: "15025",
      currencyCode: "USD",
      paidOn: "2026-09-15",
      requiredPaymentOverrideMinor: "17500",
      notes: "September payment",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/debts");
  });

  it.each([
    ["debtAccountId", { debtAccountId: "not-a-uuid" }, "Select a valid active debt account."],
    ["periodId", { periodId: "not-a-uuid" }, "Select a valid monthly period."],
    ["amount", { amount: "10.001" }, "Enter a valid payment amount for the selected debt account currency."],
    ["paidOn", { paidOn: "" }, "Enter a paid date."],
    ["paidOn", { paidOn: "2026-02-30" }, "Enter a valid paid date."],
    ["requiredPaymentOverride", { requiredPaymentOverride: "1.001" }, "Enter a valid required-payment override or leave it blank."],
    ["notes", { notes: "x".repeat(501) }, "Notes must be 500 characters or less."],
  ] as const)("returns safe payment validation feedback for %s", async (field, overrides, message) => {
    const result = await recordDebtPaymentAction(
      initialDebtPaymentActionState,
      paymentForm(overrides),
    );

    expect(result).toEqual({
      status: "error",
      message,
      fieldErrors: { [field]: message },
    });
    expect(mocks.createDebtPaymentForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns safe feedback when payment targets a missing, not-owned, or inactive debt account", async () => {
    mocks.findActiveDebtAccountForOwner.mockResolvedValueOnce(null);

    const result = await recordDebtPaymentAction(
      initialDebtPaymentActionState,
      paymentForm({ debtAccountId: "10000000-0000-0000-0000-000000000999" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Select an active debt account for your account.",
      fieldErrors: { debtAccountId: "Select an active debt account for your account." },
    });
    expect(mocks.createDebtPaymentForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns safe feedback when payment targets a missing or not-owned period", async () => {
    mocks.findPeriodForOwner.mockResolvedValueOnce(null);

    const result = await recordDebtPaymentAction(
      initialDebtPaymentActionState,
      paymentForm({ periodId: "30000000-0000-0000-0000-000000000999" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Select a monthly period for your active account.",
      fieldErrors: { periodId: "Select a monthly period for your active account." },
    });
    expect(mocks.createDebtPaymentForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns safe feedback when this account already has a payment in the selected period", async () => {
    mocks.createDebtPaymentForOwner.mockRejectedValueOnce(new DuplicateDebtPaymentError());

    const result = await recordDebtPaymentAction(initialDebtPaymentActionState, paymentForm());

    expect(result).toEqual({
      status: "error",
      message: "A payment for this account and monthly period is already recorded.",
      fieldErrors: { periodId: "A payment for this account and monthly period is already recorded." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns safe feedback when the selected period currency differs from the active debt account currency", async () => {
    mocks.findPeriodForOwner.mockResolvedValueOnce({
      id: "30000000-0000-0000-0000-000000000001",
      userId: mocks.owner.userId,
      currencyCode: "EUR",
    });

    const result = await recordDebtPaymentAction(initialDebtPaymentActionState, paymentForm());

    expect(result).toEqual({
      status: "error",
      message: "Select a monthly period that uses the same currency as the debt account.",
      fieldErrors: { periodId: "Select a monthly period that uses the same currency as the debt account." },
    });
    expect(mocks.createDebtPaymentForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    [new AuthenticationRequiredError()],
    [new UserNotActiveError()],
  ])("fails closed before payment persistence when active owner context is unavailable", async (authError) => {
    mocks.requireCurrentOwnershipContext.mockRejectedValueOnce(authError);

    const result = await recordDebtPaymentAction(initialDebtPaymentActionState, paymentForm());

    expect(result).toEqual({
      status: "error",
      message: "Sign in with an active account to record debt payments.",
      fieldErrors: {},
    });
    expect(mocks.findActiveDebtAccountForOwner).not.toHaveBeenCalled();
    expect(mocks.createDebtPaymentForOwner).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
