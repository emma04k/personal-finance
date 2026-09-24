import { describe, expect, it } from "vitest";
import { InMemoryOwnedDebtAccountRepository } from "@/modules/debt/application/owned-debt-account-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-0000-000000000002";

describe("owner-scoped debt account repository", () => {
  it("creates active debt accounts for the requested owner and lists them after persistence", async () => {
    const repository = new InMemoryOwnedDebtAccountRepository({ accounts: [] });

    const created = await repository.createDebtAccountForOwner(ownerUserId, {
      name: "Student loan",
      creditorName: "Federal Servicer",
      currentBalanceMinor: "1250000",
      defaultRequiredPaymentMinor: "15000",
      currencyCode: "USD",
    });

    expect(created).toMatchObject({
      userId: ownerUserId,
      name: "Student loan",
      creditorName: "Federal Servicer",
      currentBalanceMinor: "1250000",
      defaultRequiredPaymentMinor: "15000",
      currencyCode: "USD",
      status: "ACTIVE",
    });
    await expect(repository.listActiveDebtAccountsForOwner(ownerUserId)).resolves.toEqual([created]);
    await expect(repository.listActiveDebtAccountsForOwner(otherUserId)).resolves.toEqual([]);
  });

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

  it("updates only an active account that belongs to the requested owner", async () => {
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
          userId: otherUserId,
          name: "Other owner card",
          creditorName: "Other Bank",
          currentBalanceMinor: "999999",
          defaultRequiredPaymentMinor: "9999",
          currencyCode: "USD",
          status: "ACTIVE",
        },
        {
          id: "10000000-0000-0000-0000-000000000003",
          userId: ownerUserId,
          name: "Closed loan",
          creditorName: null,
          currentBalanceMinor: "0",
          defaultRequiredPaymentMinor: "0",
          currencyCode: "USD",
          status: "CLOSED",
        },
      ],
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

    await expect(repository.updateDebtAccountForOwner(ownerUserId, "10000000-0000-0000-0000-000000000002", {
      name: "Hostile edit",
      creditorName: null,
      currentBalanceMinor: "1",
      defaultRequiredPaymentMinor: "1",
      currencyCode: "USD",
    })).resolves.toBeNull();
    await expect(repository.updateDebtAccountForOwner(ownerUserId, "10000000-0000-0000-0000-000000000003", {
      name: "Closed edit",
      creditorName: null,
      currentBalanceMinor: "1",
      defaultRequiredPaymentMinor: "1",
      currencyCode: "USD",
    })).resolves.toBeNull();
    await expect(repository.listActiveDebtAccountsForOwner(ownerUserId)).resolves.toEqual([
      {
        id: "10000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        name: "Updated student loan",
        creditorName: null,
        currentBalanceMinor: "1000000",
        defaultRequiredPaymentMinor: "12500",
        currencyCode: "USD",
        status: "ACTIVE",
      },
    ]);
  });

  it("archives only an active account for the requested owner without removing the record", async () => {
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
          userId: otherUserId,
          name: "Other owner card",
          creditorName: "Other Bank",
          currentBalanceMinor: "999999",
          defaultRequiredPaymentMinor: "9999",
          currencyCode: "USD",
          status: "ACTIVE",
        },
        {
          id: "10000000-0000-0000-0000-000000000003",
          userId: ownerUserId,
          name: "Closed loan",
          creditorName: null,
          currentBalanceMinor: "0",
          defaultRequiredPaymentMinor: "0",
          currencyCode: "USD",
          status: "CLOSED",
        },
      ],
    });

    await expect(repository.archiveDebtAccountForOwner(ownerUserId, "10000000-0000-0000-0000-000000000001")).resolves.toEqual({
      id: "10000000-0000-0000-0000-000000000001",
      userId: ownerUserId,
      name: "Student loan",
      creditorName: "Federal Servicer",
      currentBalanceMinor: "1250000",
      defaultRequiredPaymentMinor: "15000",
      currencyCode: "USD",
      status: "CLOSED",
    });
    await expect(repository.archiveDebtAccountForOwner(ownerUserId, "10000000-0000-0000-0000-000000000002")).resolves.toBeNull();
    await expect(repository.archiveDebtAccountForOwner(ownerUserId, "10000000-0000-0000-0000-000000000003")).resolves.toBeNull();
    await expect(repository.listActiveDebtAccountsForOwner(ownerUserId)).resolves.toEqual([]);
  });
});
