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
};

export class InMemoryOwnedPlanningRepository implements OwnedPlanningRepository {
  readonly #periods: OwnedPeriod[];
  readonly #categories: OwnedCategory[];

  constructor(records: {
    readonly periods?: readonly OwnedPeriod[];
    readonly categories?: readonly OwnedCategory[];
  }) {
    this.#periods = [...(records.periods ?? [])];
    this.#categories = [...(records.categories ?? [])];
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
}
