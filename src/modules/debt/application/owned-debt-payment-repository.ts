export type OwnedDebtPayment = {
  readonly id: string;
  readonly userId: string;
  readonly periodId: string;
  readonly debtAccountId: string;
  readonly linkedTransactionId: string | null;
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

export type OwnedDebtPaymentLinkedTransaction = {
  readonly id: string;
  readonly userId: string;
  readonly periodId: string;
  readonly direction: "INFLOW" | "OUTFLOW";
  readonly amountMinor: string;
  readonly currencyCode: string;
  readonly categoryType: "INCOME" | "EXPENSE" | "SAVINGS" | "DEBT_PAYMENT" | null;
  readonly linkedDebtPaymentId: string | null;
};

export type OwnedDebtPaymentTransactionCandidate = {
  readonly id: string;
  readonly periodId: string;
  readonly occurredOn: string;
  readonly description: string;
  readonly amountMinor: string;
  readonly currencyCode: string;
  readonly categoryName: string | null;
};

export type OwnedDebtPaymentHistoryEntry = {
  readonly id: string;
  readonly accountLabel: string;
  readonly periodMonthStart: string;
  readonly amountMinor: string;
  readonly currencyCode: string;
  readonly paidOn: string;
  readonly requiredPaymentOverrideMinor: string | null;
  readonly notes: string | null;
  readonly linkedTransaction: null | {
    readonly id: string;
    readonly occurredOn: string;
    readonly description: string;
    readonly amountMinor: string;
    readonly currencyCode: string;
  };
};

export type CreateDebtPaymentForOwnerInput = {
  readonly periodId: string;
  readonly debtAccountId: string;
  readonly linkedTransactionId: string | null;
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

export class DuplicateDebtPaymentTransactionLinkError extends Error {
  constructor() {
    super("The selected transaction is already linked to another debt payment.");
    this.name = "DuplicateDebtPaymentTransactionLinkError";
  }
}

export type OwnedDebtPaymentRepository = {
  readonly listDebtPaymentsForOwner: (
    ownerUserId: string,
  ) => Promise<readonly OwnedDebtPaymentHistoryEntry[]>;
  readonly listDebtPaymentTransactionCandidatesForOwner: (
    ownerUserId: string,
  ) => Promise<readonly OwnedDebtPaymentTransactionCandidate[]>;
  readonly findActiveDebtAccountForOwner: (
    ownerUserId: string,
    debtAccountId: string,
  ) => Promise<OwnedDebtPaymentAccount | null>;
  readonly findPeriodForOwner: (
    ownerUserId: string,
    periodId: string,
  ) => Promise<OwnedDebtPaymentPeriod | null>;
  readonly findDebtPaymentLinkTransactionForOwner: (
    ownerUserId: string,
    transactionId: string,
  ) => Promise<OwnedDebtPaymentLinkedTransaction | null>;
  readonly createDebtPaymentForOwner: (
    ownerUserId: string,
    input: CreateDebtPaymentForOwnerInput,
  ) => Promise<OwnedDebtPayment>;
};
