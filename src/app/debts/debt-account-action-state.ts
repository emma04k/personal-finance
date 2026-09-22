export type DebtAccountActionField = "debtAccountId" | "name" | "creditorName" | "currentBalance" | "defaultRequiredPayment" | "currencyCode";

export type DebtAccountActionFieldErrors = Partial<Record<DebtAccountActionField, string>>;

export type DebtAccountActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: DebtAccountActionFieldErrors;
}>;

export const initialDebtAccountActionState: DebtAccountActionState = Object.freeze({
  status: "idle",
  message: "",
  fieldErrors: {},
});
