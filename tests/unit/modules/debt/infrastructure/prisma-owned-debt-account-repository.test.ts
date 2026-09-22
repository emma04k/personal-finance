import { describe, expect, it, vi } from "vitest";
import { PrismaOwnedDebtAccountRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-account-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";

describe("Prisma owner-scoped debt account repository", () => {
  it("creates active debt accounts scoped to the owner with opening balance matching current balance", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "10000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      name: "Student loan",
      creditorName: "Federal Servicer",
      currentBalanceMinor: BigInt("1250000"),
      defaultRequiredPaymentMinor: BigInt("15000"),
      currencyCode: "USD",
      status: "ACTIVE" as const,
    });
    const repository = new PrismaOwnedDebtAccountRepository({
      debtAccount: { findMany: vi.fn(), findFirst: vi.fn(), create, updateMany: vi.fn() },
    });

    await expect(repository.createDebtAccountForOwner(ownerUserId, {
      name: "Student loan",
      creditorName: "Federal Servicer",
      currentBalanceMinor: "1250000",
      defaultRequiredPaymentMinor: "15000",
      currencyCode: "USD",
    })).resolves.toEqual({
      id: "10000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      name: "Student loan",
      creditorName: "Federal Servicer",
      currentBalanceMinor: "1250000",
      defaultRequiredPaymentMinor: "15000",
      currencyCode: "USD",
      status: "ACTIVE",
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: ownerUserId,
        name: "Student loan",
        creditorName: "Federal Servicer",
        currencyCode: "USD",
        openingBalanceMinor: BigInt("1250000"),
        currentBalanceMinor: BigInt("1250000"),
        defaultRequiredPaymentMinor: BigInt("15000"),
        status: "ACTIVE",
      },
      select: {
        id: true,
        userId: true,
        name: true,
        creditorName: true,
        currentBalanceMinor: true,
        defaultRequiredPaymentMinor: true,
        currencyCode: true,
        status: true,
      },
    });
  });

  it("lists active debt accounts scoped to the owner and maps BigInt money to strings", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "10000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        name: "Student loan",
        creditorName: "Federal Servicer",
        currentBalanceMinor: BigInt("1250000"),
        defaultRequiredPaymentMinor: BigInt("15000"),
        currencyCode: "USD",
        status: "ACTIVE" as const,
      },
    ]);
    const repository = new PrismaOwnedDebtAccountRepository({
      debtAccount: { findMany, findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    });

    await expect(repository.listActiveDebtAccountsForOwner(ownerUserId)).resolves.toEqual([
      {
        id: "10000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        name: "Student loan",
        creditorName: "Federal Servicer",
        currentBalanceMinor: "1250000",
        defaultRequiredPaymentMinor: "15000",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        userId: true,
        name: true,
        creditorName: true,
        currentBalanceMinor: true,
        defaultRequiredPaymentMinor: true,
        currencyCode: true,
        status: true,
      },
      where: { userId: ownerUserId, status: "ACTIVE" },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });

  it("updates active debt accounts through owner-and-account-scoped persistence", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn().mockResolvedValue({
      id: "10000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      name: "Updated student loan",
      creditorName: null,
      currentBalanceMinor: BigInt("1000000"),
      defaultRequiredPaymentMinor: BigInt("12500"),
      currencyCode: "USD",
      status: "ACTIVE" as const,
    });
    const repository = new PrismaOwnedDebtAccountRepository({
      debtAccount: { findMany: vi.fn(), create: vi.fn(), updateMany, findFirst },
    });

    await expect(repository.updateDebtAccountForOwner(ownerUserId, "10000000-0000-0000-0000-000000000001", {
      name: "Updated student loan",
      creditorName: null,
      currentBalanceMinor: "1000000",
      defaultRequiredPaymentMinor: "12500",
      currencyCode: "USD",
    })).resolves.toEqual({
      id: "10000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      name: "Updated student loan",
      creditorName: null,
      currentBalanceMinor: "1000000",
      defaultRequiredPaymentMinor: "12500",
      currencyCode: "USD",
      status: "ACTIVE",
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "10000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        status: "ACTIVE",
      },
      data: {
        name: "Updated student loan",
        creditorName: null,
        currencyCode: "USD",
        currentBalanceMinor: BigInt("1000000"),
        defaultRequiredPaymentMinor: BigInt("12500"),
      },
    });
    expect(findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        userId: true,
        name: true,
        creditorName: true,
        currentBalanceMinor: true,
        defaultRequiredPaymentMinor: true,
        currencyCode: true,
        status: true,
      },
      where: {
        id: "10000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        status: "ACTIVE",
      },
    });
  });

  it("returns null without a follow-up read when no owner-scoped active account is updated", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findFirst = vi.fn();
    const repository = new PrismaOwnedDebtAccountRepository({
      debtAccount: { findMany: vi.fn(), create: vi.fn(), updateMany, findFirst },
    });

    await expect(repository.updateDebtAccountForOwner(ownerUserId, "10000000-0000-0000-0000-000000000999", {
      name: "Hostile edit",
      creditorName: null,
      currentBalanceMinor: "1",
      defaultRequiredPaymentMinor: "1",
      currencyCode: "USD",
    })).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
