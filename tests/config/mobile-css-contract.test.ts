import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve("src/app/globals.css"), "utf8");
const rootLayout = readFileSync(resolve("src/app/layout.tsx"), "utf8");

function declarationBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));

  expect(match, `Missing CSS rule for ${selector}`).not.toBeNull();
  return match![1];
}

describe("mobile shell CSS contracts", () => {
  it("keeps at least eight CSS pixels between bottom navigation targets", () => {
    const bottomNav = declarationBlock(".bottom-nav");
    const gap = bottomNav.match(/\bgap:\s*([\d.]+)px\s*;/);

    expect(gap, "The bottom navigation needs a fixed pixel gap").not.toBeNull();
    expect(Number(gap![1])).toBeGreaterThanOrEqual(8);
  });

  it("preserves browser text scaling from a readable base size", () => {
    const html = declarationBlock("html");
    const body = declarationBlock("body");

    expect(html).toMatch(/(?:-webkit-)?text-size-adjust:\s*100%\s*;/);
    expect(body).toMatch(/font-size:\s*(?:1rem|16px)\s*;/);
    expect(stylesheet).not.toMatch(/maximum-scale\s*=|user-scalable\s*=\s*no/);
  });

  it("declares safe-area insets and reduced-motion overrides", () => {
    expect(rootLayout).toMatch(/viewportFit:\s*["']cover["']/);
    expect(stylesheet).toMatch(/\.mobile-header[\s\S]*env\(safe-area-inset-top\)/);
    expect(stylesheet).toMatch(/\.bottom-nav[\s\S]*env\(safe-area-inset-bottom\)/);
    expect(stylesheet).toMatch(/\.quick-add-sheet[\s\S]*env\(safe-area-inset-bottom\)/);
    expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(stylesheet).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(stylesheet).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });
});
