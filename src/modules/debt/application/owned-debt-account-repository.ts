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

export type UpdateDebtAccountForOwnerInput = CreateDebtAccountForOwnerInput;

export type OwnedDebtAccountRepository = {
  readonly listActiveDebtAccountsForOwner: (ownerUserId: string) => Promise<readonly OwnedDebtAccount[]>;
  readonly createDebtAccountForOwner: (
    ownerUserId: string,
    input: CreateDebtAccountForOwnerInput,
  ) => Promise<OwnedDebtAccount>;
  readonly updateDebtAccountForOwner: (
    ownerUserId: string,
    debtAccountId: string,
    input: UpdateDebtAccountForOwnerInput,
  ) => Promise<OwnedDebtAccount | null>;
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

  async updateDebtAccountForOwner(
    ownerUserId: string,
    debtAccountId: string,
    input: UpdateDebtAccountForOwnerInput,
  ) {
    const accountIndex = this.#accounts.findIndex(
      (account) => account.id === debtAccountId && account.userId === ownerUserId && account.status === "ACTIVE",
    );
    if (accountIndex === -1) return null;

    const updatedAccount: OwnedDebtAccount = {
      ...this.#accounts[accountIndex],
      name: input.name,
      creditorName: input.creditorName,
      currentBalanceMinor: input.currentBalanceMinor,
      defaultRequiredPaymentMinor: input.defaultRequiredPaymentMinor,
      currencyCode: input.currencyCode,
    };
    this.#accounts[accountIndex] = updatedAccount;
    return updatedAccount;
  }
}
