import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("Phase 16 debt payment transaction link schema contract", () => {
  it("models an optional owner-scoped one-to-one link from DebtPayment to Transaction", async () => {
    const schema = await readFile("prisma/schema.prisma", "utf8");
    const sql = await allMigrationSql();

    expect(schema).toMatch(/model Transaction \{[\s\S]*@@unique\(\[id, userId\]\)[\s\S]*\}/);
    expect(schema).toMatch(/model Transaction \{[\s\S]*linkedDebtPayment\s+DebtPayment\?\s+@relation\("DebtPaymentLinkedTransaction"\)[\s\S]*\}/);
    expect(schema).toMatch(/model DebtPayment \{[\s\S]*transactionId\s+String\?\s+@db\.Uuid[\s\S]*\}/);
    expect(schema).toMatch(/model DebtPayment \{[\s\S]*linkedTransaction\s+Transaction\?\s+@relation\("DebtPaymentLinkedTransaction", fields: \[transactionId, userId\], references: \[id, userId\], onDelete: Restrict\)[\s\S]*\}/);
    expect(schema).toMatch(/model DebtPayment \{[\s\S]*@@unique\(\[transactionId\]\)[\s\S]*\}/);
    expect(schema).toMatch(/model DebtPayment \{[\s\S]*@@unique\(\[transactionId, userId\]\)[\s\S]*\}/);
    expect(schema).toMatch(/model DebtPayment \{[\s\S]*@@index\(\[userId, transactionId\]\)[\s\S]*\}/);

    expect(sql).toContain("ALTER TABLE \"DebtPayment\" ADD COLUMN \"transactionId\" UUID");
    expect(sql).toContain("CREATE UNIQUE INDEX \"DebtPayment_transactionId_key\" ON \"DebtPayment\"(\"transactionId\")");
    expect(sql).toContain("CREATE UNIQUE INDEX \"DebtPayment_transactionId_userId_key\" ON \"DebtPayment\"(\"transactionId\", \"userId\")");
    expect(sql).toContain("CREATE INDEX \"DebtPayment_userId_transactionId_idx\" ON \"DebtPayment\"(\"userId\", \"transactionId\")");
    expect(sql).toContain("ALTER TABLE \"DebtPayment\" ADD CONSTRAINT \"DebtPayment_transactionId_userId_fkey\" FOREIGN KEY (\"transactionId\", \"userId\") REFERENCES \"Transaction\"(\"id\", \"userId\") ON DELETE RESTRICT ON UPDATE CASCADE");
  });
});
