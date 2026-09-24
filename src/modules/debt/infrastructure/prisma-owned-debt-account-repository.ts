import type {
  CreateDebtAccountForOwnerInput,
  OwnedDebtAccount,
  OwnedDebtAccountRepository,
  UpdateDebtAccountForOwnerInput,
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
    readonly findFirst: PrismaDelegateMethod;
    readonly create: PrismaDelegateMethod;
    readonly updateMany: PrismaDelegateMethod;
  };
};

const debtAccountSelect = {
  id: true,
  userId: true,
  name: true,
  creditorName: true,
  currentBalanceMinor: true,
  defaultRequiredPaymentMinor: true,
  currencyCode: true,
  status: true,
} as const;

export class PrismaOwnedDebtAccountRepository implements OwnedDebtAccountRepository {
  constructor(private readonly db: DebtAccountPrismaClient) {}

  async listActiveDebtAccountsForOwner(ownerUserId: string) {
    const records = await findManyDebtAccounts(this.db.debtAccount, {
      select: debtAccountSelect,
      where: { userId: ownerUserId, status: "ACTIVE" },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    return records.map(toOwnedDebtAccount);
  }

  async createDebtAccountForOwner(
    ownerUserId: string,
    input: CreateDebtAccountForOwnerInput,
  ) {
    const record = await createDebtAccount(this.db.debtAccount, {
      data: {
        userId: ownerUserId,
        name: input.name,
        creditorName: input.creditorName,
        currencyCode: input.currencyCode,
        openingBalanceMinor: BigInt(input.currentBalanceMinor),
        currentBalanceMinor: BigInt(input.currentBalanceMinor),
        defaultRequiredPaymentMinor: BigInt(input.defaultRequiredPaymentMinor),
        status: "ACTIVE",
      },
      select: debtAccountSelect,
    });

    return toOwnedDebtAccount(record);
  }

  async updateDebtAccountForOwner(
    ownerUserId: string,
    debtAccountId: string,
    input: UpdateDebtAccountForOwnerInput,
  ) {
    const where = { id: debtAccountId, userId: ownerUserId, status: "ACTIVE" };
    const updateResult = await updateManyDebtAccounts(this.db.debtAccount, {
      where,
      data: {
        name: input.name,
        creditorName: input.creditorName,
        currencyCode: input.currencyCode,
        currentBalanceMinor: BigInt(input.currentBalanceMinor),
        defaultRequiredPaymentMinor: BigInt(input.defaultRequiredPaymentMinor),
      },
    });

    if (updateResult.count === 0) return null;

    const record = await findFirstDebtAccount(this.db.debtAccount, {
      select: debtAccountSelect,
      where,
    });

    return record ? toOwnedDebtAccount(record) : null;
  }

  async archiveDebtAccountForOwner(ownerUserId: string, debtAccountId: string) {
    const activeWhere = { id: debtAccountId, userId: ownerUserId, status: "ACTIVE" };
    const updateResult = await updateManyDebtAccounts(this.db.debtAccount, {
      where: activeWhere,
      data: {
        status: "CLOSED",
        closedOn: new Date(),
      },
    });

    if (updateResult.count === 0) return null;

    const record = await findFirstDebtAccount(this.db.debtAccount, {
      select: debtAccountSelect,
      where: { id: debtAccountId, userId: ownerUserId, status: "CLOSED" },
    });

    return record ? toOwnedDebtAccount(record) : null;
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

async function createDebtAccount(
  delegate: DebtAccountPrismaClient["debtAccount"],
  args: Record<string, unknown>,
) {
  return (delegate.create as (
    args: Record<string, unknown>
  ) => Promise<PrismaDebtAccountRecord>)(args);
}

async function updateManyDebtAccounts(
  delegate: DebtAccountPrismaClient["debtAccount"],
  args: Record<string, unknown>,
) {
  return (delegate.updateMany as (
    args: Record<string, unknown>
  ) => Promise<{ readonly count: number }>)(args);
}

async function findFirstDebtAccount(
  delegate: DebtAccountPrismaClient["debtAccount"],
  args: Record<string, unknown>,
) {
  return (delegate.findFirst as (
    args: Record<string, unknown>
  ) => Promise<PrismaDebtAccountRecord | null>)(args);
}
