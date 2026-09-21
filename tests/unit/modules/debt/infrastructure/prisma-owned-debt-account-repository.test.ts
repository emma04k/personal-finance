import { describe, expect, it, vi } from "vitest";
import { PrismaOwnedDebtAccountRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-account-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";

describe("Prisma owner-scoped debt account repository", () => {
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
      debtAccount: { findMany },
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
