export type BudgetLineActionField = "periodId" | "categoryId" | "plannedAmount" | "currencyCode";

export type BudgetLineActionFieldErrors = Partial<Record<BudgetLineActionField, string>>;

export type BudgetLineActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: BudgetLineActionFieldErrors;
}>;

export const initialBudgetLineActionState: BudgetLineActionState = Object.freeze({
  status: "idle",
  message: "",
  fieldErrors: {},
});
