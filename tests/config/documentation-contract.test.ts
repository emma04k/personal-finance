import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readmePath = resolve("README.md");
const runbookPath = resolve("docs/mvp-production-readiness-runbook.md");
const checklistPath = resolve("docs/mvp-acceptance-checklist.md");

function source(path: string) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function expectMarkdownAnchors(markdown: string, anchors: readonly string[]) {
  for (const anchor of anchors) {
    expect(markdown).toContain(anchor);
  }
}

describe("MVP release hardening documentation contract", () => {
  it("keeps the README aligned with the supported MVP workflows instead of Phase 0", () => {
    const readme = source(readmePath);

    expect(readme).not.toMatch(/Phase 0 provides only|future scope and are intentionally absent from this phase/i);
    expectMarkdownAnchors(readme, [
      "## Supported MVP workflows",
      "### Authenticated budgeting and periods",
      "### Transactions drive actual totals",
      "### Debt accounts, payments, links, and diagnostic",
      "### Monthly CSV, XLSX, and PDF exports",
      "### Workbook preview and apply",
      "### Workbook debt diagnostic defaults",
      "## Release hardening docs",
    ]);
    expect(readme).toMatch(/authenticated owner|server-derived ownership/i);
    expect(readme).toMatch(/transactions? (?:are|as) the source of actual totals/i);
    expect(readme).toMatch(/linked transaction/i);
    expect(readme).toMatch(/default required payment/i);
    expect(readme).toMatch(/docs\/mvp-production-readiness-runbook\.md/);
    expect(readme).toMatch(/docs\/mvp-acceptance-checklist\.md/);
  });

  it("adds a production readiness runbook with deployment, data, and rollback gates", () => {
    expect(existsSync(runbookPath)).toBe(true);
    const runbook = source(runbookPath);

    expectMarkdownAnchors(runbook, [
      "# MVP production readiness runbook",
      "## Scope and non-goals",
      "## Secret handling",
      "## Docker-first local verification",
      "## CI gates and expected commands",
      "## Staging checklist",
      "## Production checklist",
      "## Database migrations and backups",
      "## Restore and rollback procedures",
      "## HTTPS, security headers, retention, and deletion",
      "## Synthetic-data-only staging verification",
      "## Known deferred scope and unsupported operations",
    ]);
    expect(runbook).toMatch(/npm run test/);
    expect(runbook).toMatch(/npm run lint/);
    expect(runbook).toMatch(/npm run typecheck/);
    expect(runbook).toMatch(/npm run build/);
    expect(runbook).toMatch(/npm run db:validate/);
    expect(runbook).toMatch(/npm run test:e2e/);
    expect(runbook).toMatch(/backup/i);
    expect(runbook).toMatch(/restore/i);
    expect(runbook).toMatch(/rollback/i);
    expect(runbook).toMatch(/synthetic data/i);
    expect(runbook).not.toMatch(/postgres(?:ql)?:\/\/[^\s<]+|sk-[A-Za-z0-9_-]{20,}|password\s*[:=]\s*[^\s<\[]/i);
  });

  it("adds an MVP acceptance checklist that maps plan criteria to evidence and manual gates", () => {
    expect(existsSync(checklistPath)).toBe(true);
    const checklist = source(checklistPath);

    expectMarkdownAnchors(checklist, [
      "# MVP acceptance checklist",
      "## Evidence model",
      "## Plan acceptance matrix",
      "## iPhone and real-device gates",
      "## E2E, accessibility, and responsive validation",
      "## Docker-first validation",
      "## Import and export acceptance",
      "## Manual staging and production gates",
      "## Sign-off record",
    ]);
    expect(checklist).toMatch(/iPhone/i);
    expect(checklist).toMatch(/real device/i);
    expect(checklist).toMatch(/accessibility/i);
    expect(checklist).toMatch(/responsive/i);
    expect(checklist).toMatch(/Docker/i);
    expect(checklist).toMatch(/CSV/i);
    expect(checklist).toMatch(/XLSX/i);
    expect(checklist).toMatch(/PDF/i);
    expect(checklist).toMatch(/workbook/i);
    expect(checklist).toMatch(/staging/i);
    expect(checklist).toMatch(/production/i);
    expect(checklist).not.toMatch(/postgres(?:ql)?:\/\/[^\s<]+|sk-[A-Za-z0-9_-]{20,}|password\s*[:=]\s*[^\s<\[]/i);
  });
});
