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

export type OwnedPlanningRepository = {
  readonly listPeriodsForOwner: (ownerUserId: string) => Promise<readonly OwnedPeriod[]>;
  readonly findPeriodForOwner: (
    ownerUserId: string,
    periodId: string,
  ) => Promise<OwnedPeriod | null>;
  readonly listActiveCategoriesForOwner: (ownerUserId: string) => Promise<readonly OwnedCategory[]>;
  readonly findCategoryForOwner: (
    ownerUserId: string,
    categoryId: string,
  ) => Promise<OwnedCategory | null>;
};

export class InMemoryOwnedPlanningRepository implements OwnedPlanningRepository {
  readonly #periods: readonly OwnedPeriod[];
  readonly #categories: readonly OwnedCategory[];

  constructor(records: {
    readonly periods?: readonly OwnedPeriod[];
    readonly categories?: readonly OwnedCategory[];
  }) {
    this.#periods = records.periods ?? [];
    this.#categories = records.categories ?? [];
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
}
