import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const templatePath = resolve("docs/staging-release-evidence-template.md");
const runbookPath = resolve("docs/mvp-production-readiness-runbook.md");
const checklistPath = resolve("docs/mvp-acceptance-checklist.md");

function source(path: string) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function expectContainsAll(markdown: string, snippets: readonly string[]) {
  for (const snippet of snippets) {
    expect(markdown).toContain(snippet);
  }
}

describe("staging release evidence template contract", () => {
  it("provides a synthetic-data-only evidence record with required release fields", () => {
    expect(existsSync(templatePath)).toBe(true);
    const template = source(templatePath);

    expectContainsAll(template, [
      "# Staging release evidence template",
      "<TARGET_COMMIT_SHA>",
      "<STAGING_URL>",
      "<ENVIRONMENT_NAME>",
      "<RELEASE_OWNER>",
      "<EVIDENCE_LINK>",
      "<APPROVER_NAME>",
      "## CI evidence",
      "## Docker-first evidence",
      "## HTTPS and security-header evidence",
      "## Synthetic smoke results",
      "## Import/export evidence",
      "## Mobile and iPhone evidence",
      "## Approvals",
    ]);

    expect(template).toMatch(/target commit SHA/i);
    expect(template).toMatch(/staging URL/i);
    expect(template).toMatch(/environment name/i);
    expect(template).toMatch(/release owner/i);
  });

  it("forbids secrets, secret locations, production data, and real workbook values", () => {
    expect(existsSync(templatePath)).toBe(true);
    const template = source(templatePath);

    expectContainsAll(template, [
      "real personal workbook values",
      "production data",
      "access tokens",
      "session cookies",
      "API keys",
      "connection strings",
      "secret manager paths",
      "synthetic data only",
    ]);

    expect(template).not.toMatch(/https?:\/\/(?!<STAGING_URL>)[^\s)]+/i);
    expect(template).not.toMatch(/postgres(?:ql)?:\/\/[^\s<]+/i);
    expect(template).not.toMatch(/(?:mongodb|mysql|redis):\/\/[^\s<]+/i);
    expect(template).not.toMatch(/AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}/i);
    expect(template).not.toMatch(/(?:session|cookie|token|api[_-]?key|password|secret)\s*[:=]\s*[^\s<\[]/i);
    expect(template).not.toMatch(/(?:op:\/\/|arn:aws:secretsmanager|projects\/[^\s]+\/secrets\/|vault\/[^\s]+)/i);
  });

  it("maps every staging checklist item from the production readiness runbook", () => {
    expect(existsSync(templatePath)).toBe(true);
    const template = source(templatePath);
    const runbook = source(runbookPath);

    expect(runbook).toContain("## Staging checklist");
    expectContainsAll(template, [
      "staging deployment target",
      "image/tag",
      "commit SHA",
      "environment name",
      "secrets are loaded from the approved secret manager",
      "not production secrets",
      "HTTPS is enabled",
      "security headers are present",
      "smoke sign-in with a synthetic account",
      "synthetic monthly period",
      "category",
      "planned income row",
      "planned expense row",
      "transactions",
      "synthetic debt account",
      "debt payment",
      "eligible transaction",
      "debt diagnostic",
      "synthetic income",
      "default required payment",
      "CSV",
      "XLSX",
      "PDF",
      "synthetic workbook",
      "apply planned rows",
      "existing synthetic active debt accounts",
      "configured Playwright iPhone viewport",
      "real iPhone Safari device",
    ]);
  });

  it("maps manual evidence rows from the MVP acceptance checklist sign-off record", () => {
    expect(existsSync(templatePath)).toBe(true);
    const template = source(templatePath);
    const checklist = source(checklistPath);

    expect(checklist).toContain("## Sign-off record");
    expectContainsAll(template, [
      "Docker-first validation",
      "CI gates",
      "E2E/mobile",
      "Real iPhone Safari",
      "Import/export",
      "Production readiness",
      "Environment",
      "Evidence link or command",
      "Result",
      "Approver",
      "Date",
    ]);
  });
});
