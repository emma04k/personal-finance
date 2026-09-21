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
      debtAccount: { findMany: vi.fn(), create },
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
      debtAccount: { findMany, create: vi.fn() },
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
});
