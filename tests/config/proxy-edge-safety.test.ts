import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("proxy Edge safety", () => {
  it("does not import server-only auth or persistence dependencies", async () => {
    const source = await readFile("src/proxy.ts", "utf8");

    expect(source).not.toMatch(/from\s+["']node:/);
    expect(source).not.toMatch(/@prisma\/client|PrismaClient|bcrypt|next-auth|Auth\.js/i);
    expect(source).not.toMatch(/\b(fs|path|crypto as nodeCrypto|Buffer)\b/);
  });
});
