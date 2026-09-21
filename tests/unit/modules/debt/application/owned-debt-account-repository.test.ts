import { describe, expect, it } from "vitest";
import { InMemoryOwnedDebtAccountRepository } from "@/modules/debt/application/owned-debt-account-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-0000-000000000002";

describe("owner-scoped debt account repository", () => {
  it("lists only active debt accounts for the requested owner", async () => {
    const repository = new InMemoryOwnedDebtAccountRepository({
      accounts: [
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
        {
          id: "10000000-0000-0000-0000-000000000002",
          userId: ownerUserId,
          name: "Paid off card",
          creditorName: null,
          currentBalanceMinor: "0",
          defaultRequiredPaymentMinor: "0",
          currencyCode: "USD",
          status: "PAID_OFF",
        },
        {
          id: "10000000-0000-0000-0000-000000000003",
          userId: otherUserId,
          name: "Other owner card",
          creditorName: "Other Bank",
          currentBalanceMinor: "999999",
          defaultRequiredPaymentMinor: "9999",
          currencyCode: "USD",
          status: "ACTIVE",
        },
      ],
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
  });
});
