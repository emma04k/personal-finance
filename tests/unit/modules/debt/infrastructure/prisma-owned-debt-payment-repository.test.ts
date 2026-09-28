import { describe, expect, it, vi } from "vitest";
import {
  DuplicateDebtPaymentError,
  DuplicateDebtPaymentTransactionLinkError,
} from "@/modules/debt/application/owned-debt-payment-repository";
import { PrismaOwnedDebtPaymentRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-payment-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";

describe("Prisma owner-scoped debt payment repository", () => {
  it("lists owner-scoped debt payment history with safe review fields in deterministic order", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "20000000-0000-0000-0000-000000000002",
        amountMinor: BigInt("17500"),
        currencyCode: "USD",
        paidOn: new Date("2026-09-20T00:00:00.000Z"),
        requiredPaymentOverrideMinor: null,
        notes: null,
        debtAccount: { name: "Auto loan" },
        period: { monthStart: new Date("2026-09-01T00:00:00.000Z") },
        linkedTransaction: null,
      },
      {
        id: "20000000-0000-0000-0000-000000000001",
        amountMinor: BigInt("15025"),
        currencyCode: "USD",
        paidOn: new Date("2026-09-15T00:00:00.000Z"),
        requiredPaymentOverrideMinor: BigInt("16000"),
        notes: "September payment",
        debtAccount: { name: "Student loan" },
        period: { monthStart: new Date("2026-09-01T00:00:00.000Z") },
        linkedTransaction: {
          id: "50000000-0000-0000-0000-000000000001",
          occurredOn: new Date("2026-09-15T00:00:00.000Z"),
          description: "Student loan payment",
          amountMinor: BigInt("15025"),
          currencyCode: "USD",
        },
      },
    ]);
    const repository = new PrismaOwnedDebtPaymentRepository({
      debtAccount: { findFirst: vi.fn() },
      period: { findFirst: vi.fn() },
      debtPayment: { create: vi.fn(), findMany },
    });

    await expect(repository.listDebtPaymentsForOwner(ownerUserId)).resolves.toEqual([
      {
        id: "20000000-0000-0000-0000-000000000002",
        accountLabel: "Auto loan",
        periodMonthStart: "2026-09-01",
        amountMinor: "17500",
        currencyCode: "USD",
        paidOn: "2026-09-20",
        requiredPaymentOverrideMinor: null,
        notes: null,
        linkedTransaction: null,
      },
      {
        id: "20000000-0000-0000-0000-000000000001",
        accountLabel: "Student loan",
        periodMonthStart: "2026-09-01",
        amountMinor: "15025",
        currencyCode: "USD",
        paidOn: "2026-09-15",
        requiredPaymentOverrideMinor: "16000",
        notes: "September payment",
        linkedTransaction: {
          id: "50000000-0000-0000-0000-000000000001",
          occurredOn: "2026-09-15",
          description: "Student loan payment",
          amountMinor: "15025",
          currencyCode: "USD",
        },
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        amountMinor: true,
        currencyCode: true,
        paidOn: true,
        requiredPaymentOverrideMinor: true,
        notes: true,
        debtAccount: { select: { name: true } },
        period: { select: { monthStart: true } },
        linkedTransaction: { select: { id: true, occurredOn: true, description: true, amountMinor: true, currencyCode: true } },
      },
      where: { userId: ownerUserId },
      orderBy: [{ paidOn: "desc" }, { id: "asc" }],
    });
  });

  it("creates debt payments scoped to owner, period, and active debt account without updating debt balance", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "20000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      periodId: "30000000-0000-0000-0000-000000000001",
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      transactionId: "50000000-0000-0000-0000-000000000001",
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
      debtPayment: { create, findMany: vi.fn() },
    });

    await expect(repository.createDebtPaymentForOwner(ownerUserId, {
      periodId: "30000000-0000-0000-0000-000000000001",
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      linkedTransactionId: "50000000-0000-0000-0000-000000000001",
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
      linkedTransactionId: "50000000-0000-0000-0000-000000000001",
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
        transactionId: "50000000-0000-0000-0000-000000000001",
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
        transactionId: true,
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
      debtPayment: { create: vi.fn(), findMany: vi.fn() },
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
      debtPayment: { create: vi.fn(), findMany: vi.fn() },
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

  it("lists safe owner-scoped debt payment transaction candidates without linked payments", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "50000000-0000-0000-0000-000000000001",
        periodId: "30000000-0000-0000-0000-000000000001",
        occurredOn: new Date("2026-09-15T00:00:00.000Z"),
        description: "Student loan payment",
        amountMinor: BigInt("15025"),
        currencyCode: "USD",
        category: { name: "Debt", type: "DEBT_PAYMENT" },
      },
    ]);
    const repository = new PrismaOwnedDebtPaymentRepository({
      debtAccount: { findFirst: vi.fn() },
      period: { findFirst: vi.fn() },
      debtPayment: { create: vi.fn(), findMany: vi.fn() },
      transaction: { findMany, findFirst: vi.fn() },
    });

    await expect(repository.listDebtPaymentTransactionCandidatesForOwner(ownerUserId)).resolves.toEqual([
      {
        id: "50000000-0000-0000-0000-000000000001",
        periodId: "30000000-0000-0000-0000-000000000001",
        occurredOn: "2026-09-15",
        description: "Student loan payment",
        amountMinor: "15025",
        currencyCode: "USD",
        categoryName: "Debt",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        periodId: true,
        occurredOn: true,
        description: true,
        amountMinor: true,
        currencyCode: true,
        category: { select: { name: true, type: true } },
      },
      where: {
        userId: ownerUserId,
        direction: "OUTFLOW",
        linkedDebtPayment: null,
        OR: [
          { category: { is: null } },
          { category: { is: { type: "DEBT_PAYMENT" } } },
        ],
      },
      orderBy: [{ occurredOn: "desc" }, { id: "asc" }],
    });
  });

  it("finds linked transaction validation details for only the authenticated owner", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "50000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      periodId: "30000000-0000-0000-0000-000000000001",
      direction: "OUTFLOW",
      amountMinor: BigInt("15025"),
      currencyCode: "USD",
      category: { type: "DEBT_PAYMENT" },
      linkedDebtPayment: null,
    });
    const repository = new PrismaOwnedDebtPaymentRepository({
      debtAccount: { findFirst: vi.fn() },
      period: { findFirst: vi.fn() },
      debtPayment: { create: vi.fn(), findMany: vi.fn() },
      transaction: { findMany: vi.fn(), findFirst },
    });

    await expect(repository.findDebtPaymentLinkTransactionForOwner(ownerUserId, "50000000-0000-0000-0000-000000000001")).resolves.toEqual({
      id: "50000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      periodId: "30000000-0000-0000-0000-000000000001",
      direction: "OUTFLOW",
      amountMinor: "15025",
      currencyCode: "USD",
      categoryType: "DEBT_PAYMENT",
      linkedDebtPaymentId: null,
    });
    expect(findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        userId: true,
        periodId: true,
        direction: true,
        amountMinor: true,
        currencyCode: true,
        category: { select: { type: true } },
        linkedDebtPayment: { select: { id: true } },
      },
      where: { id: "50000000-0000-0000-0000-000000000001", userId: ownerUserId },
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
      debtPayment: { create, findMany: vi.fn() },
    });

    await expect(repository.createDebtPaymentForOwner(ownerUserId, {
      periodId: "30000000-0000-0000-0000-000000000001",
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      linkedTransactionId: null,
      amountMinor: "15025",
      currencyCode: "USD",
      paidOn: "2026-09-15",
      requiredPaymentOverrideMinor: null,
      notes: null,
    })).rejects.toBeInstanceOf(DuplicateDebtPaymentError);
  });

  it("maps duplicate linked transaction uniqueness failures to a domain duplicate link error", async () => {
    const create = vi.fn().mockRejectedValue({
      code: "P2002",
      meta: { target: ["transactionId"] },
    });
    const repository = new PrismaOwnedDebtPaymentRepository({
      debtAccount: { findFirst: vi.fn() },
      period: { findFirst: vi.fn() },
      debtPayment: { create, findMany: vi.fn() },
    });

    await expect(repository.createDebtPaymentForOwner(ownerUserId, {
      periodId: "30000000-0000-0000-0000-000000000001",
      debtAccountId: "10000000-0000-0000-0000-000000000001",
      linkedTransactionId: "50000000-0000-0000-0000-000000000001",
      amountMinor: "15025",
      currencyCode: "USD",
      paidOn: "2026-09-15",
      requiredPaymentOverrideMinor: null,
      notes: null,
    })).rejects.toBeInstanceOf(DuplicateDebtPaymentTransactionLinkError);
  });
});
