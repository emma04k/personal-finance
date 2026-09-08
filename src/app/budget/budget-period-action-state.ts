export type BudgetPeriodActionField = "monthStart" | "currencyCode" | "timeZone" | "note";

export type BudgetPeriodActionFieldErrors = Partial<Record<BudgetPeriodActionField, string>>;

export type BudgetPeriodActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: BudgetPeriodActionFieldErrors;
}>;

export const initialBudgetPeriodActionState: BudgetPeriodActionState = Object.freeze({
  status: "idle",
  message: "",
  fieldErrors: {},
});
