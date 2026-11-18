import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

describe("initial-owner bootstrap operator contract", () => {
  it("wires the explicit one-time bootstrap command without a public registration path", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      scripts?: Record<string, string>;
    };
    const readme = source("README.md");

    expect(packageJson.scripts?.["bootstrap:first-owner"]).toBe(
      "node --experimental-strip-types scripts/bootstrap-first-owner.ts",
    );
    expect(readme).toContain("## Initial owner bootstrap");
    expect(readme).toContain("npm run bootstrap:first-owner -- --subject <AUTH0_BROKER_SUBJECT> --email <OWNER_EMAIL> --confirm");
    expect(readme).toContain("`DATABASE_URL` from the process environment");
    expect(readme).toMatch(/does not create a public registration/i);
  });
});
