export type BudgetCategoryActionField = "type" | "name";

export type BudgetCategoryActionFieldErrors = Partial<Record<BudgetCategoryActionField, string>>;

export type BudgetCategoryActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: BudgetCategoryActionFieldErrors;
}>;

export const initialBudgetCategoryActionState: BudgetCategoryActionState = Object.freeze({
  status: "idle",
  message: "",
  fieldErrors: {},
});
