import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationRequiredError,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";
import { loadDebtAccountListState } from "@/app/debts/debt-account-list-state";

const ownerUserId = "00000000-0000-0000-0000-000000000001";

describe("/debts account list state", () => {
  it("loads active debt accounts for the authenticated owner", async () => {
    const accounts = [
      {
        id: "10000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        name: "Student loan",
        creditorName: "Federal Servicer",
        currentBalanceMinor: "1250000",
        defaultRequiredPaymentMinor: "15000",
        currencyCode: "USD",
        status: "ACTIVE" as const,
      },
    ];
    const periods = [
      {
        id: "30000000-0000-0000-0000-000000000001",
        userId: ownerUserId,
        monthStart: "2026-09-01",
        currencyCode: "USD",
        timeZone: "America/New_York",
        note: null,
      },
    ];
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn().mockResolvedValue(accounts),
    };
    const planningRepository = {
      listPeriodsForOwner: vi.fn().mockResolvedValue(periods),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => ({ userId: ownerUserId, role: "OWNER", email: "owner@example.com" }),
      repository,
      planningRepository,
    })).resolves.toEqual({ status: "authenticated", accounts, periods });
    expect(repository.listActiveDebtAccountsForOwner).toHaveBeenCalledWith(ownerUserId);
    expect(planningRepository.listPeriodsForOwner).toHaveBeenCalledWith(ownerUserId);
  });

  it("fails closed without querying accounts when authentication is missing", async () => {
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn(),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => {
        throw new AuthenticationRequiredError();
      },
      repository,
    })).resolves.toEqual({ status: "authentication-required" });
    expect(repository.listActiveDebtAccountsForOwner).not.toHaveBeenCalled();
  });

  it("fails closed without querying accounts when the owner is inactive", async () => {
    const repository = {
      listActiveDebtAccountsForOwner: vi.fn(),
    };

    await expect(loadDebtAccountListState({
      getOwner: async () => {
        throw new UserNotActiveError();
      },
      repository,
    })).resolves.toEqual({ status: "authentication-required" });
    expect(repository.listActiveDebtAccountsForOwner).not.toHaveBeenCalled();
  });
});
