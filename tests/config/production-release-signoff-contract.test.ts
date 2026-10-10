import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const templatePath = resolve("docs/production-release-signoff-template.md");
const runbookPath = resolve("docs/mvp-production-readiness-runbook.md");
const checklistPath = resolve("docs/mvp-acceptance-checklist.md");
const readmePath = resolve("README.md");
const templateLink = "docs/production-release-signoff-template.md";

function source(path: string) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function expectContainsAll(markdown: string, snippets: readonly string[]) {
  for (const snippet of snippets) {
    expect(markdown).toContain(snippet);
  }
}

function section(markdown: string, heading: string) {
  const start = markdown.indexOf(heading);
  expect(start, `Missing heading ${heading}`).toBeGreaterThanOrEqual(0);
  const rest = markdown.slice(start + heading.length);
  const nextHeading = rest.search(/\n##\s/);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
}

describe("production release sign-off template contract", () => {
  it("provides final MVP release decision metadata without authorizing deployment", () => {
    expect(existsSync(templatePath)).toBe(true);
    const template = source(templatePath);

    expectContainsAll(template, [
      "# Production release sign-off template",
      "does not authorize deployment",
      "does not replace explicit release approval",
      "## Safety rules",
      "## Release decision metadata",
      "<RELEASE_OWNER>",
      "<REVIEWER_NAME>",
      "<ROLLBACK_OWNER>",
      "<TARGET_COMMIT_SHA>",
      "<APPROVER_NAME>",
      "<DATE>",
    ]);
  });

  it("requires CI, artifact, backup, restore, and secret confirmations using placeholders only", () => {
    expect(existsSync(templatePath)).toBe(true);
    const template = source(templatePath);

    expectContainsAll(template, [
      "## CI and artifact evidence",
      "CI/main evidence",
      "Reviewed build artifact",
      "Last known good artifact",
      "Target commit SHA",
      "## Backup, restore, and rollback readiness",
      "Backup confirmation",
      "Restore confirmation",
      "Rollback owner",
      "## Production configuration confirmation",
      "Production secret confirmation without values",
      "HTTPS/security headers",
      "Cookie/cache behavior",
      "<CI_MAIN_EVIDENCE>",
      "<REVIEWED_BUILD_ARTIFACT>",
      "<LAST_KNOWN_GOOD_ARTIFACT>",
      "<BACKUP_CONFIRMATION>",
      "<RESTORE_CONFIRMATION>",
      "<SECURITY_HEADER_EVIDENCE>",
      "<COOKIE_CACHE_EVIDENCE>",
    ]);
  });

  it("records post-release smoke ownership, checks, triggers, and go-no-go approval", () => {
    expect(existsSync(templatePath)).toBe(true);
    const template = source(templatePath);

    expectContainsAll(template, [
      "## Post-release smoke plan",
      "Post-release smoke owner",
      "Smoke window",
      "Smoke checks",
      "Sign-in reaches the authenticated app shell",
      "Budget period and transaction lists load for the authenticated owner",
      "Debt account and debt payment history load for the authenticated owner",
      "Report export route returns a file response",
      "Workbook preview remains side-effect free",
      "Workbook apply updates only the selected synthetic period",
      "## Rollback triggers",
      "failed health check",
      "failed sign-in",
      "failed owner-scoped data read",
      "failed export",
      "failed import apply",
      "data integrity anomaly",
      "unacceptable error rate",
      "## Go/no-go decision",
      "<GO_OR_NO_GO>",
      "<APPROVER_NAME>",
      "<DATE>",
    ]);
  });

  it("forbids real URLs, secrets, backup locations, provider identifiers, private screenshots, and customer data", () => {
    expect(existsSync(templatePath)).toBe(true);
    const template = source(templatePath);

    expectContainsAll(template, [
      "Use placeholders only",
      "No real staging or production URLs",
      "tokens",
      "cookies",
      "connection strings",
      "secret-manager paths",
      "backup locations",
      "customer data",
      "workbook values",
      "screenshots with private data",
      "provider-specific identifiers",
      "production secret values",
    ]);

    expect(template).not.toMatch(/https?:\/\/(?!<ENVIRONMENT_URL>|<EVIDENCE_LINK>|<CI_MAIN_EVIDENCE>|<REVIEWED_BUILD_ARTIFACT>|<LAST_KNOWN_GOOD_ARTIFACT>|<SECURITY_HEADER_EVIDENCE>|<COOKIE_CACHE_EVIDENCE>)[^\s)]+/i);
    expect(template).not.toMatch(/postgres(?:ql)?:\/\/[^\s<]+/i);
    expect(template).not.toMatch(/(?:mongodb|mysql|redis):\/\/[^\s<]+/i);
    expect(template).not.toMatch(/AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}/i);
    expect(template).not.toMatch(/(?:session|cookie|token|api[_-]?key|password|secret)\s*[:=]\s*[^\s<\[]/i);
    expect(template).not.toMatch(/(?:op:\/\/|arn:aws:secretsmanager|projects\/[^\s]+\/secrets\/|vault\/[^\s]+)/i);
  });

  it("links the template from production and readiness documentation sections", () => {
    const runbook = source(runbookPath);
    const checklist = source(checklistPath);
    const readme = source(readmePath);

    expect(section(runbook, "## Production checklist")).toContain(templateLink);
    expect(section(runbook, "## Restore and rollback procedures")).toContain(templateLink);
    expect(section(checklist, "## Manual staging and production gates")).toContain(templateLink);
    expect(section(checklist, "## Sign-off record")).toContain(templateLink);
    expect(section(readme, "## Release hardening docs")).toContain(templateLink);
  });
});
