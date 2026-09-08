import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const REQUIRED_MODELS = [
  "User",
  "UserPreference",
  "OidcAccount",
  "Period",
  "Category",
  "BudgetLine",
  "Transaction",
  "RecurringRule",
  "DebtAccount",
  "DebtPayment",
  "Goal",
  "ImportJob",
  "AuditEvent",
] as const;

const USER_OWNED_MODELS = [
  "UserPreference",
  "Period",
  "Category",
  "BudgetLine",
  "Transaction",
  "RecurringRule",
  "DebtAccount",
  "DebtPayment",
  "Goal",
  "ImportJob",
] as const;

const REQUIRED_ENUM_VALUES: Record<string, readonly string[]> = {
  UserStatus: ["INVITED", "ACTIVE", "SUSPENDED"],
  UserRole: ["OWNER", "MEMBER"],
  CategoryType: ["INCOME", "EXPENSE", "SAVINGS", "DEBT_PAYMENT"],
  BudgetLineKind: ["PLANNED", "ACTUAL"],
  TransactionDirection: ["INFLOW", "OUTFLOW"],
  RecurringFrequency: ["WEEKLY", "MONTHLY", "YEARLY"],
  RuleStatus: ["ACTIVE", "PAUSED", "ENDED"],
  DebtStatus: ["ACTIVE", "PAID_OFF", "CLOSED"],
  GoalStatus: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  ImportJobType: ["WORKBOOK"],
  ImportJobStatus: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
  AuditAction: ["CREATE", "UPDATE", "DELETE", "IMPORT", "AUTHENTICATE"],
};

const FINANCIAL_SOURCE_AMOUNT_FIELDS = [
  "plannedAmountMinor",
  "actualAmountMinor",
  "amountMinor",
  "openingBalanceMinor",
  "currentBalanceMinor",
  "defaultRequiredPaymentMinor",
  "requiredPaymentOverrideMinor",
  "targetAmountMinor",
  "currentAmountMinor",
] as const;

async function schema() {
  return readFile("prisma/schema.prisma", "utf8");
}

function block(source: string, kind: "model" | "enum", name: string): string {
  const match = source.match(new RegExp(`${kind}\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Missing ${kind} ${name}`);
  return match[1];
}

function expectModelToHaveUserOwnership(source: string, name: string) {
  const model = block(source, "model", name);

  expect(model, `${name} must store the server-derived owner id`).toMatch(/\buserId\s+String\b/);
  expect(model, `${name} must relate records to User`).toMatch(/\buser\s+User\s+@relation\(/);
  expect(model, `${name} must index tenant ownership lookups`).toMatch(/@@index\(\[userId\]/);
}

describe("Phase 2 Prisma persistence schema contract", () => {
  it("defines the required persistence models and enums", async () => {
    const source = await schema();

    for (const model of REQUIRED_MODELS) {
      expect(() => block(source, "model", model)).not.toThrow();
    }

    for (const [enumName, values] of Object.entries(REQUIRED_ENUM_VALUES)) {
      const enumBlock = block(source, "enum", enumName);
      for (const value of values) {
        expect(enumBlock, `${enumName} must include ${value}`).toMatch(
          new RegExp(`\\b${value}\\b`),
        );
      }
    }
  });

  it("prepares invite-only OIDC identities without app-owned passwords or recovery secrets", async () => {
    const source = await schema();
    const user = block(source, "model", "User");
    const oidcAccount = block(source, "model", "OidcAccount");

    expect(source).not.toMatch(/\b(password|passwordHash|hashedPassword|recoveryToken|resetToken)\b/i);
    expect(user).toMatch(/\bemail\s+String\s+@unique\b/);
    expect(user).toMatch(/\bdisplayName\s+String\?/);
    expect(user).toMatch(/\bstatus\s+UserStatus\b/);
    expect(user).toMatch(/\brole\s+UserRole\b/);
    expect(user).toMatch(/\boidcAccounts\s+OidcAccount\[\]/);
    expect(oidcAccount).toMatch(/\bprovider\s+String\b/);
    expect(oidcAccount).toMatch(/\bproviderAccountId\s+String\b/);
    expect(oidcAccount).toMatch(/@@unique\(\[provider, providerAccountId\]/);
    expect(oidcAccount).toMatch(/@@index\(\[userId\]/);
  });

  it("makes every user-owned financial record tenant scoped and lookup-indexed", async () => {
    const source = await schema();

    for (const model of USER_OWNED_MODELS) {
      expectModelToHaveUserOwnership(source, model);
    }

    expect(block(source, "model", "Period")).toMatch(/@@unique\(\[userId, monthStart\]/);
    expect(block(source, "model", "Category")).toMatch(/@@unique\(\[userId, type, name\]/);
    expect(block(source, "model", "BudgetLine")).toMatch(/@@unique\(\[periodId, categoryId\]/);
    expect(block(source, "model", "DebtPayment")).toMatch(/@@unique\(\[periodId, debtAccountId\]/);
    expect(block(source, "model", "DebtAccount")).toMatch(/@@unique\(\[userId, name\]/);
    expect(block(source, "model", "Goal")).toMatch(/@@unique\(\[userId, name\]/);
  });

  it("uses composite ownership relations for child records instead of trusting client-owned parent ids", async () => {
    const source = await schema();

    for (const parent of ["Period", "Category", "DebtAccount"] as const) {
      expect(block(source, "model", parent)).toMatch(/@@unique\(\[id, userId\]/);
    }

    const budgetLine = block(source, "model", "BudgetLine");
    expect(budgetLine).toMatch(/fields:\s*\[periodId, userId\],\s*references:\s*\[id, userId\]/);
    expect(budgetLine).toMatch(/fields:\s*\[categoryId, userId\],\s*references:\s*\[id, userId\]/);

    const transaction = block(source, "model", "Transaction");
    expect(transaction).toMatch(/fields:\s*\[periodId, userId\],\s*references:\s*\[id, userId\]/);
    expect(transaction).toMatch(/fields:\s*\[categoryId, userId\],\s*references:\s*\[id, userId\]/);

    const debtPayment = block(source, "model", "DebtPayment");
    expect(debtPayment).toMatch(/fields:\s*\[periodId, userId\],\s*references:\s*\[id, userId\]/);
    expect(debtPayment).toMatch(/fields:\s*\[debtAccountId, userId\],\s*references:\s*\[id, userId\]/);
  });

  it("preserves explicit currency and timezone choices while storing source amounts as bigint minor units", async () => {
    const source = await schema();

    expect(block(source, "model", "UserPreference")).toMatch(/\bcurrencyCode\s+String\b[\s\S]*\btimeZone\s+String\b/);
    expect(block(source, "model", "Period")).toMatch(/\bcurrencyCode\s+String\b[\s\S]*\btimeZone\s+String\b/);
    expect(source).not.toMatch(/infer(red)?Currency|currencySymbol|workbookCurrency/i);
    expect(source).not.toMatch(/\bDecimal\b|\bFloat\b/);

    for (const field of FINANCIAL_SOURCE_AMOUNT_FIELDS) {
      expect(source, `${field} must be stored as BigInt minor units`).toMatch(
        new RegExp(`\\b${field}\\s+BigInt\\??\\b`),
      );
    }

    const debtAccount = block(source, "model", "DebtAccount");
    const debtPayment = block(source, "model", "DebtPayment");
    expect(debtAccount).toMatch(/\bdefaultRequiredPaymentMinor\s+BigInt\b/);
    expect(debtPayment).toMatch(/\brequiredPaymentOverrideMinor\s+BigInt\?/);
  });

  it("adds workflow and audit indexes needed for imports and owner-scoped history", async () => {
    const source = await schema();

    expect(block(source, "model", "RecurringRule")).toMatch(/@@index\(\[userId, status, nextDueOn\]/);
    expect(block(source, "model", "ImportJob")).toMatch(/@@index\(\[userId, status, createdAt\]/);

    const auditEvent = block(source, "model", "AuditEvent");
    expect(auditEvent).toMatch(/\bownerUserId\s+String\b/);
    expect(auditEvent).toMatch(/\bactorUserId\s+String\?/);
    expect(auditEvent).toMatch(/@@index\(\[ownerUserId, createdAt\]/);
    expect(auditEvent).toMatch(/@@index\(\[actorUserId, createdAt\]/);
    expect(auditEvent).toMatch(/@@index\(\[entityType, entityId\]/);
  });
});
