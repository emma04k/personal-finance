import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) return walkFiles(path);
      return [path];
    }),
  );
  return files.flat();
}

describe("public registration surface", () => {
  it("has no public sign-up route or password registration copy", async () => {
    await expect(fileExists("src/app/auth/register/page.tsx")).resolves.toBe(false);
    await expect(fileExists("src/app/register/page.tsx")).resolves.toBe(false);

    const appFiles = await walkFiles("src/app");
    const source = await Promise.all(appFiles.map((file) => readFile(file, "utf8")));
    const combined = source.join("\n").toLowerCase();

    expect(combined).not.toMatch(/create password|confirm password|passwordhash/);
    expect(combined).not.toMatch(/public registration|sign up now|create an account/);
  });
});
