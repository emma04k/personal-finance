export type OwnedDebtPayment = {
  readonly id: string;
  readonly userId: string;
  readonly periodId: string;
  readonly debtAccountId: string;
  readonly amountMinor: string;
  readonly currencyCode: string;
  readonly paidOn: string;
  readonly requiredPaymentOverrideMinor: string | null;
  readonly notes: string | null;
};

export type OwnedDebtPaymentAccount = {
  readonly id: string;
  readonly userId: string;
  readonly currencyCode: string;
  readonly status: "ACTIVE";
};

export type OwnedDebtPaymentPeriod = {
  readonly id: string;
  readonly userId: string;
  readonly currencyCode: string;
};

export type CreateDebtPaymentForOwnerInput = {
  readonly periodId: string;
  readonly debtAccountId: string;
  readonly amountMinor: string;
  readonly currencyCode: string;
  readonly paidOn: string;
  readonly requiredPaymentOverrideMinor: string | null;
  readonly notes: string | null;
};

export class DuplicateDebtPaymentError extends Error {
  constructor() {
    super("A debt payment already exists for this account and period.");
    this.name = "DuplicateDebtPaymentError";
  }
}

export type OwnedDebtPaymentRepository = {
  readonly findActiveDebtAccountForOwner: (
    ownerUserId: string,
    debtAccountId: string,
  ) => Promise<OwnedDebtPaymentAccount | null>;
  readonly findPeriodForOwner: (
    ownerUserId: string,
    periodId: string,
  ) => Promise<OwnedDebtPaymentPeriod | null>;
  readonly createDebtPaymentForOwner: (
    ownerUserId: string,
    input: CreateDebtPaymentForOwnerInput,
  ) => Promise<OwnedDebtPayment>;
};
