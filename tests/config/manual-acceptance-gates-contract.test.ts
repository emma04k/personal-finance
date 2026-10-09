import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const guidePath = resolve("docs/manual-acceptance-gates.md");
const templatePath = resolve("docs/staging-release-evidence-template.md");
const checklistPath = resolve("docs/mvp-acceptance-checklist.md");
const guideLink = "docs/manual-acceptance-gates.md";

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

describe("manual acceptance gate guide contract", () => {
  it("adds a reviewer-operated guide with required manual gate anchors", () => {
    expect(existsSync(guidePath)).toBe(true);
    const guide = source(guidePath);

    expectContainsAll(guide, [
      "# Manual acceptance gates",
      "## Scope and reviewer operation",
      "## Safe evidence placeholders",
      "## Forbidden data and secret handling",
      "## Real iPhone Safari review",
      "## Playwright iPhone viewport evidence",
      "## Responsive and accessibility review",
      "## Import and export file review",
      "## Workbook preview and apply review",
      "## Debt default apply review",
      "## Owner-scoped synthetic smoke checks",
      "## Evidence record",
    ]);

    expect(guide).toMatch(/manual|reviewer-operated/i);
    expect(guide).toMatch(/does not (?:claim|record) automated completion/i);
    expect(guide).toMatch(/not (?:a )?(?:staging )?deployment/i);
  });

  it("uses placeholders for review metadata and forbids real data or secrets", () => {
    expect(existsSync(guidePath)).toBe(true);
    const guide = source(guidePath);

    expectContainsAll(guide, [
      "<ENVIRONMENT_URL>",
      "<DEVICE_MODEL>",
      "<IOS_VERSION>",
      "<SAFARI_VERSION>",
      "<TESTER_NAME>",
      "<EVIDENCE_LINK>",
      "<APPROVER_NAME>",
      "synthetic data only",
      "real personal workbook values",
      "production data",
      "tokens",
      "cookies",
      "API keys",
      "connection strings",
      "secret manager paths",
    ]);

    expect(guide).not.toMatch(/https?:\/\/(?!<ENVIRONMENT_URL>)[^\s)]+/i);
    expect(guide).not.toMatch(/postgres(?:ql)?:\/\/[^\s<]+/i);
    expect(guide).not.toMatch(/(?:mongodb|mysql|redis):\/\/[^\s<]+/i);
    expect(guide).not.toMatch(/AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}/i);
    expect(guide).not.toMatch(/(?:session|cookie|token|api[_-]?key|password|secret)\s*[:=]\s*[^\s<\[]/i);
    expect(guide).not.toMatch(/(?:op:\/\/|arn:aws:secretsmanager|projects\/[^\s]+\/secrets\/|vault\/[^\s]+)/i);
  });

  it("covers every required manual review lane with synthetic owner-scoped evidence", () => {
    expect(existsSync(guidePath)).toBe(true);
    const guide = source(guidePath);

    expectContainsAll(guide, [
      "real iPhone Safari",
      "Playwright iPhone viewport",
      "portrait",
      "landscape",
      "Text scaling",
      "touch targets",
      "horizontal scrolling",
      "CSV",
      "XLSX",
      "PDF",
      "workbook preview",
      "Apply planned rows",
      "default required payment",
      "existing active debt accounts",
      "accessibility feedback",
      "owner-scoped",
      "synthetic smoke",
    ]);
  });

  it("links the staging evidence template from mobile, import-export, and manual evidence areas", () => {
    const template = source(templatePath);

    expect(section(template, "## Import/export evidence")).toContain(guideLink);
    expect(section(template, "## Mobile and iPhone evidence")).toContain(guideLink);
    expect(section(template, "## Synthetic smoke results")).toContain(guideLink);
  });

  it("links the MVP acceptance checklist from manual gate sections", () => {
    const checklist = source(checklistPath);

    expect(section(checklist, "## iPhone and real-device gates")).toContain(guideLink);
    expect(section(checklist, "## E2E, accessibility, and responsive validation")).toContain(guideLink);
    expect(section(checklist, "## Import and export acceptance")).toContain(guideLink);
    expect(section(checklist, "## Manual staging and production gates")).toContain(guideLink);
  });
});
