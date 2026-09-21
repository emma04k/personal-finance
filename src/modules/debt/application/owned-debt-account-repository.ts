export type OwnedDebtAccountStatus = "ACTIVE" | "PAID_OFF" | "CLOSED";

export type OwnedDebtAccount = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly creditorName: string | null;
  readonly currentBalanceMinor: string;
  readonly defaultRequiredPaymentMinor: string;
  readonly currencyCode: string;
  readonly status: OwnedDebtAccountStatus;
};

export type OwnedDebtAccountRepository = {
  readonly listActiveDebtAccountsForOwner: (ownerUserId: string) => Promise<readonly OwnedDebtAccount[]>;
};

export class InMemoryOwnedDebtAccountRepository implements OwnedDebtAccountRepository {
  readonly #accounts: OwnedDebtAccount[];

  constructor(records: { readonly accounts?: readonly OwnedDebtAccount[] }) {
    this.#accounts = [...(records.accounts ?? [])];
  }

  async listActiveDebtAccountsForOwner(ownerUserId: string) {
    return this.#accounts.filter(
      (account) => account.userId === ownerUserId && account.status === "ACTIVE",
    );
  }
}
