import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const NON_NEGATIVE_AMOUNT_CHECKS: Record<string, readonly string[]> = {
  BudgetLine: ["plannedAmountMinor", "actualAmountMinor"],
  Transaction: ["amountMinor"],
  RecurringRule: ["amountMinor"],
  DebtAccount: [
    "openingBalanceMinor",
    "currentBalanceMinor",
    "defaultRequiredPaymentMinor",
  ],
  DebtPayment: ["amountMinor", "requiredPaymentOverrideMinor"],
  Goal: ["targetAmountMinor", "currentAmountMinor"],
};

async function allMigrationSql() {
  const root = "prisma/migrations";
  const entries = await readdir(root, { withFileTypes: true });
  const migrations = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readFile(join(root, entry.name, "migration.sql"), "utf8")),
  );

  return migrations.join("\n");
}

describe("Phase 2 Prisma migration contract", () => {
  it("adds database check constraints for non-negative source money fields", async () => {
    const sql = await allMigrationSql();

    for (const [table, fields] of Object.entries(NON_NEGATIVE_AMOUNT_CHECKS)) {
      for (const field of fields) {
        expect(sql, `${table}.${field} must reject negative source amounts`).toContain(
          `CONSTRAINT "${table}_${field}_non_negative" CHECK`,
        );
        expect(sql).toMatch(new RegExp(`"${field}"(?: IS NULL OR "${field}")? >= 0`));
      }
    }
  });
});
