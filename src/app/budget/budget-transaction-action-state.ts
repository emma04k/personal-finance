export type BudgetTransactionActionField = "periodId" | "categoryId" | "amount" | "currencyCode" | "occurredOn" | "description";

export type BudgetTransactionActionFieldErrors = Partial<Record<BudgetTransactionActionField, string>>;

export type BudgetTransactionActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: BudgetTransactionActionFieldErrors;
}>;

export const initialBudgetTransactionActionState: BudgetTransactionActionState = Object.freeze({
  status: "idle",
  message: "",
  fieldErrors: {},
});
