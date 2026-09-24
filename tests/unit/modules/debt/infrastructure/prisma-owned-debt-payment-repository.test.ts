import { describe, expect, it, vi } from "vitest";
import { DuplicateDebtPaymentError } from "@/modules/debt/application/owned-debt-payment-repository";
import { PrismaOwnedDebtPaymentRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-payment-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";

describe("Prisma owner-scoped debt payment repository", () => {
  it("creates debt payments scoped to owner, period, and active debt account without updating debt balance", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "20000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      periodId: "30000000-0000-0000-0000-000000000001",
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      amountMinor: BigInt("15025"),
      currencyCode: "USD",
      paidOn: new Date("2026-09-15T00:00:00.000Z"),
      requiredPaymentOverrideMinor: BigInt("17500"),
      notes: "September payment",
    });
    const debtAccountUpdateMany = vi.fn();
    const repository = new PrismaOwnedDebtPaymentRepository({
      debtAccount: { findFirst: vi.fn(), updateMany: debtAccountUpdateMany },
      period: { findFirst: vi.fn() },
      debtPayment: { create },
    });

    await expect(repository.createDebtPaymentForOwner(ownerUserId, {
      periodId: "30000000-0000-0000-0000-000000000001",
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      amountMinor: "15025",
      currencyCode: "USD",
      paidOn: "2026-09-15",
      requiredPaymentOverrideMinor: "17500",
      notes: "September payment",
    })).resolves.toEqual({
      id: "20000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      periodId: "30000000-0000-0000-0000-000000000001",
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      amountMinor: "15025",
      currencyCode: "USD",
      paidOn: "2026-09-15",
      requiredPaymentOverrideMinor: "17500",
      notes: "September payment",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: ownerUserId,
        periodId: "30000000-0000-0000-0000-000000000001",
        debtAccountId: "10000000-0000-0000-0000-000000000001",
        amountMinor: BigInt("15025"),
        currencyCode: "USD",
        paidOn: new Date("2026-09-15T00:00:00.000Z"),
        requiredPaymentOverrideMinor: BigInt("17500"),
        notes: "September payment",
      },
      select: {
        id: true,
        userId: true,
        periodId: true,
        debtAccountId: true,
        amountMinor: true,
        currencyCode: true,
        paidOn: true,
        requiredPaymentOverrideMinor: true,
        notes: true,
      },
    });
    expect(debtAccountUpdateMany).not.toHaveBeenCalled();
  });

  it("finds only active owner-scoped debt accounts for payment recording", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "10000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      currencyCode: "USD",
      status: "ACTIVE" as const,
    });
    const repository = new PrismaOwnedDebtPaymentRepository({
      debtAccount: { findFirst },
      period: { findFirst: vi.fn() },
      debtPayment: { create: vi.fn() },
    });

    await expect(repository.findActiveDebtAccountForOwner(ownerUserId, "10000000-0000-0000-0000-000000000001")).resolves.toEqual({
      id: "10000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      currencyCode: "USD",
      status: "ACTIVE",
    });
    expect(findFirst).toHaveBeenCalledWith({
      select: { id: true, userId: true, currencyCode: true, status: true },
      where: { id: "10000000-0000-0000-0000-000000000001", userId: ownerUserId, status: "ACTIVE" },
    });
  });

  it("finds only owner-scoped periods for payment recording", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "30000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      currencyCode: "USD",
    });
    const repository = new PrismaOwnedDebtPaymentRepository({
      debtAccount: { findFirst: vi.fn() },
      period: { findFirst },
      debtPayment: { create: vi.fn() },
    });

    await expect(repository.findPeriodForOwner(ownerUserId, "30000000-0000-0000-0000-000000000001")).resolves.toEqual({
      id: "30000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      currencyCode: "USD",
    });
    expect(findFirst).toHaveBeenCalledWith({
      select: { id: true, userId: true, currencyCode: true },
      where: { id: "30000000-0000-0000-0000-000000000001", userId: ownerUserId },
    });
  });

  it("maps duplicate account-period payments to a domain duplicate error", async () => {
    const create = vi.fn().mockRejectedValue({
      code: "P2002",
      meta: { target: ["periodId", "debtAccountId"] },
    });
    const repository = new PrismaOwnedDebtPaymentRepository({
      debtAccount: { findFirst: vi.fn() },
      period: { findFirst: vi.fn() },
      debtPayment: { create },
    });

    await expect(repository.createDebtPaymentForOwner(ownerUserId, {
      periodId: "30000000-0000-0000-0000-000000000001",
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      amountMinor: "15025",
      currencyCode: "USD",
      paidOn: "2026-09-15",
      requiredPaymentOverrideMinor: null,
      notes: null,
    })).rejects.toBeInstanceOf(DuplicateDebtPaymentError);
  });
});
