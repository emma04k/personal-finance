export type OwnedPeriod = {
  readonly id: string;
  readonly userId: string;
  readonly monthStart: string;
  readonly currencyCode: string;
  readonly timeZone: string;
  readonly note?: string | null;
};

export type OwnedCategory = {
  readonly id: string;
  readonly userId: string;
  readonly type: "INCOME" | "EXPENSE" | "SAVINGS" | "DEBT_PAYMENT";
  readonly name: string;
  readonly sortOrder: number;
  readonly archivedAt: string | null;
};

export type OwnedBudgetLine = {
  readonly id: string;
  readonly userId: string;
  readonly periodId: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly categoryType: OwnedCategory["type"];
  readonly plannedAmountMinor: string;
  readonly currencyCode: string;
};

export type OwnedTransaction = {
  readonly id: string;
  readonly userId: string;
  readonly periodId: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly categoryType: OwnedCategory["type"];
  readonly direction: "INFLOW" | "OUTFLOW";
  readonly amountMinor: string;
  readonly currencyCode: string;
  readonly occurredOn: string;
  readonly description: string;
};

export class DuplicateMonthlyPeriodError extends Error {
  constructor() {
    super("A monthly period already exists for this owner and month.");
    this.name = "DuplicateMonthlyPeriodError";
  }
}

export class DuplicateCategoryError extends Error {
  constructor() {
    super("A category already exists for this owner, type, and name.");
    this.name = "DuplicateCategoryError";
  }
}

export type CreatePeriodForOwnerInput = {
  readonly monthStart: string;
  readonly currencyCode: string;
  readonly timeZone: string;
  readonly note?: string | null;
};

export type CreateCategoryForOwnerInput = {
  readonly type: OwnedCategory["type"];
  readonly name: string;
};

export type UpsertPlannedBudgetLineForOwnerInput = {
  readonly periodId: string;
  readonly categoryId: string;
  readonly plannedAmountMinor: string;
  readonly currencyCode: string;
};

export type CreateTransactionForOwnerInput = {
  readonly periodId: string;
  readonly categoryId: string;
  readonly direction: OwnedTransaction["direction"];
  readonly amountMinor: string;
  readonly currencyCode: string;
  readonly occurredOn: string;
  readonly description: string;
};

export type OwnedPlanningRepository = {
  readonly listPeriodsForOwner: (ownerUserId: string) => Promise<readonly OwnedPeriod[]>;
  readonly findPeriodForOwner: (
    ownerUserId: string,
    periodId: string,
  ) => Promise<OwnedPeriod | null>;
  readonly findPeriodByMonthForOwner: (
    ownerUserId: string,
    monthStart: string,
  ) => Promise<OwnedPeriod | null>;
  readonly createPeriodForOwner: (
    ownerUserId: string,
    input: CreatePeriodForOwnerInput,
  ) => Promise<OwnedPeriod>;
  readonly listActiveCategoriesForOwner: (ownerUserId: string) => Promise<readonly OwnedCategory[]>;
  readonly findCategoryForOwner: (
    ownerUserId: string,
    categoryId: string,
  ) => Promise<OwnedCategory | null>;
  readonly createCategoryForOwner: (
    ownerUserId: string,
    input: CreateCategoryForOwnerInput,
  ) => Promise<OwnedCategory>;
  readonly listPlannedBudgetLinesForOwnerPeriod: (
    ownerUserId: string,
    periodId: string,
  ) => Promise<readonly OwnedBudgetLine[]>;
  readonly upsertPlannedBudgetLineForOwner: (
    ownerUserId: string,
    input: UpsertPlannedBudgetLineForOwnerInput,
  ) => Promise<OwnedBudgetLine>;
  readonly listTransactionsForOwnerPeriod: (
    ownerUserId: string,
    periodId: string,
  ) => Promise<readonly OwnedTransaction[]>;
  readonly createTransactionForOwner: (
    ownerUserId: string,
    input: CreateTransactionForOwnerInput,
  ) => Promise<OwnedTransaction>;
};

export class InMemoryOwnedPlanningRepository implements OwnedPlanningRepository {
  readonly #periods: OwnedPeriod[];
  readonly #categories: OwnedCategory[];
  readonly #budgetLines: OwnedBudgetLine[];
  readonly #transactions: OwnedTransaction[];

  constructor(records: {
    readonly periods?: readonly OwnedPeriod[];
    readonly categories?: readonly OwnedCategory[];
    readonly budgetLines?: readonly OwnedBudgetLine[];
    readonly transactions?: readonly OwnedTransaction[];
  }) {
    this.#periods = [...(records.periods ?? [])];
    this.#categories = [...(records.categories ?? [])];
    this.#budgetLines = [...(records.budgetLines ?? [])];
    this.#transactions = [...(records.transactions ?? [])];
  }

  async listPeriodsForOwner(ownerUserId: string) {
    return this.#periods.filter((period) => period.userId === ownerUserId);
  }

  async findPeriodForOwner(ownerUserId: string, periodId: string) {
    return (
      this.#periods.find(
        (period) => period.userId === ownerUserId && period.id === periodId,
      ) ?? null
    );
  }

  async findPeriodByMonthForOwner(ownerUserId: string, monthStart: string) {
    return (
      this.#periods.find(
        (period) => period.userId === ownerUserId && period.monthStart === monthStart,
      ) ?? null
    );
  }

  async createPeriodForOwner(ownerUserId: string, input: CreatePeriodForOwnerInput) {
    const period: OwnedPeriod = {
      id: crypto.randomUUID(),
      userId: ownerUserId,
      monthStart: input.monthStart,
      currencyCode: input.currencyCode,
      timeZone: input.timeZone,
      note: input.note ?? null,
    };
    this.#periods.push(period);
    return period;
  }

  async listActiveCategoriesForOwner(ownerUserId: string) {
    return this.#categories.filter(
      (category) => category.userId === ownerUserId && category.archivedAt === null,
    );
  }

  async findCategoryForOwner(ownerUserId: string, categoryId: string) {
    return (
      this.#categories.find(
        (category) => category.userId === ownerUserId && category.id === categoryId,
      ) ?? null
    );
  }

  async createCategoryForOwner(ownerUserId: string, input: CreateCategoryForOwnerInput) {
    const duplicate = this.#categories.some(
      (category) => category.userId === ownerUserId
        && category.type === input.type
        && category.name === input.name,
    );
    if (duplicate) throw new DuplicateCategoryError();

    const category: OwnedCategory = {
      id: crypto.randomUUID(),
      userId: ownerUserId,
      type: input.type,
      name: input.name,
      sortOrder: 0,
      archivedAt: null,
    };
    this.#categories.push(category);
    return category;
  }

  async listPlannedBudgetLinesForOwnerPeriod(ownerUserId: string, periodId: string) {
    return this.#budgetLines.filter(
      (budgetLine) => budgetLine.userId === ownerUserId && budgetLine.periodId === periodId,
    );
  }

  async upsertPlannedBudgetLineForOwner(
    ownerUserId: string,
    input: UpsertPlannedBudgetLineForOwnerInput,
  ) {
    const category = this.#categories.find(
      (record) => record.userId === ownerUserId && record.id === input.categoryId,
    );
    const existing = this.#budgetLines.find(
      (record) => record.userId === ownerUserId
        && record.periodId === input.periodId
        && record.categoryId === input.categoryId,
    );
    if (existing) {
      const updated: OwnedBudgetLine = {
        ...existing,
        plannedAmountMinor: input.plannedAmountMinor,
        currencyCode: input.currencyCode,
      };
      this.#budgetLines.splice(this.#budgetLines.indexOf(existing), 1, updated);
      return updated;
    }

    const budgetLine: OwnedBudgetLine = {
      id: crypto.randomUUID(),
      userId: ownerUserId,
      periodId: input.periodId,
      categoryId: input.categoryId,
      categoryName: category?.name ?? "",
      categoryType: category?.type ?? "EXPENSE",
      plannedAmountMinor: input.plannedAmountMinor,
      currencyCode: input.currencyCode,
    };
    this.#budgetLines.push(budgetLine);
    return budgetLine;
  }

  async listTransactionsForOwnerPeriod(ownerUserId: string, periodId: string) {
    return this.#transactions.filter(
      (transaction) => transaction.userId === ownerUserId && transaction.periodId === periodId,
    );
  }

  async createTransactionForOwner(
    ownerUserId: string,
    input: CreateTransactionForOwnerInput,
  ) {
    const category = this.#categories.find(
      (record) => record.userId === ownerUserId && record.id === input.categoryId,
    );
    const transaction: OwnedTransaction = {
      id: crypto.randomUUID(),
      userId: ownerUserId,
      periodId: input.periodId,
      categoryId: input.categoryId,
      categoryName: category?.name ?? "",
      categoryType: category?.type ?? "EXPENSE",
      direction: input.direction,
      amountMinor: input.amountMinor,
      currencyCode: input.currencyCode,
      occurredOn: input.occurredOn,
      description: input.description,
    };
    this.#transactions.push(transaction);
    return transaction;
  }
}
