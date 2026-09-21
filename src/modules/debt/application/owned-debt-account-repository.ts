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

export type CreateDebtAccountForOwnerInput = {
  readonly name: string;
  readonly creditorName: string | null;
  readonly currentBalanceMinor: string;
  readonly defaultRequiredPaymentMinor: string;
  readonly currencyCode: string;
};

export type OwnedDebtAccountRepository = {
  readonly listActiveDebtAccountsForOwner: (ownerUserId: string) => Promise<readonly OwnedDebtAccount[]>;
  readonly createDebtAccountForOwner: (
    ownerUserId: string,
    input: CreateDebtAccountForOwnerInput,
  ) => Promise<OwnedDebtAccount>;
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

  async createDebtAccountForOwner(
    ownerUserId: string,
    input: CreateDebtAccountForOwnerInput,
  ) {
    const account: OwnedDebtAccount = {
      id: `debt-account-${this.#accounts.length + 1}`,
      userId: ownerUserId,
      name: input.name,
      creditorName: input.creditorName,
      currentBalanceMinor: input.currentBalanceMinor,
      defaultRequiredPaymentMinor: input.defaultRequiredPaymentMinor,
      currencyCode: input.currencyCode,
      status: "ACTIVE",
    };
    this.#accounts.push(account);
    return account;
  }
}
