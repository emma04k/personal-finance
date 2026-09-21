import type {
  OwnedDebtAccount,
  OwnedDebtAccountRepository,
} from "@/modules/debt/application/owned-debt-account-repository";

type PrismaDebtAccountRecord = Omit<
  OwnedDebtAccount,
  "currentBalanceMinor" | "defaultRequiredPaymentMinor"
> & {
  readonly currentBalanceMinor: bigint | number | string;
  readonly defaultRequiredPaymentMinor: bigint | number | string;
};

type PrismaDelegateMethod = (args: never) => Promise<unknown>;

type DebtAccountPrismaClient = {
  readonly debtAccount: {
    readonly findMany: PrismaDelegateMethod;
  };
};

export class PrismaOwnedDebtAccountRepository implements OwnedDebtAccountRepository {
  constructor(private readonly db: DebtAccountPrismaClient) {}

  async listActiveDebtAccountsForOwner(ownerUserId: string) {
    const records = await findManyDebtAccounts(this.db.debtAccount, {
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

    return records.map(toOwnedDebtAccount);
  }
}

function toOwnedDebtAccount(record: PrismaDebtAccountRecord): OwnedDebtAccount {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    creditorName: record.creditorName,
    currentBalanceMinor: record.currentBalanceMinor.toString(),
    defaultRequiredPaymentMinor: record.defaultRequiredPaymentMinor.toString(),
    currencyCode: record.currencyCode,
    status: record.status,
  };
}

async function findManyDebtAccounts(
  delegate: DebtAccountPrismaClient["debtAccount"],
  args: Record<string, unknown>,
) {
  return (delegate.findMany as (
    args: Record<string, unknown>
  ) => Promise<readonly PrismaDebtAccountRecord[]>)(args);
}
