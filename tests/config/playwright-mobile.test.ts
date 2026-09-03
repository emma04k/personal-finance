import { describe, expect, it } from "vitest";
import playwrightConfig from "../../playwright.config";

function project(name: string) {
  const match = playwrightConfig.projects?.find((candidate) => candidate.name === name);
  expect(match, `Missing Playwright project: ${name}`).toBeDefined();
  return match!;
}

describe("Playwright mobile acceptance configuration", () => {
  it("defines explicit iPhone 13 Pro Max portrait and landscape WebKit projects", () => {
    const portrait = project("webkit-iphone-13-pro-max-portrait");
    const landscape = project("webkit-iphone-13-pro-max-landscape");

    expect(portrait.use?.defaultBrowserType).toBe("webkit");
    expect(portrait.use?.viewport).toEqual({ width: 428, height: 746 });
    expect(landscape.use?.defaultBrowserType).toBe("webkit");
    expect(landscape.use?.viewport).toEqual({ width: 832, height: 380 });
    expect(portrait.use?.hasTouch).toBe(true);
    expect(landscape.use?.hasTouch).toBe(true);
  });
});
