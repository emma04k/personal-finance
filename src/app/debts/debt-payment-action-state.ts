export type DebtPaymentActionField = "debtAccountId" | "periodId" | "amount" | "paidOn" | "requiredPaymentOverride" | "notes";

export type DebtPaymentActionFieldErrors = Partial<Record<DebtPaymentActionField, string>>;

export type DebtPaymentActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: DebtPaymentActionFieldErrors;
}>;

export const initialDebtPaymentActionState: DebtPaymentActionState = Object.freeze({
  status: "idle",
  message: "",
  fieldErrors: {},
});
