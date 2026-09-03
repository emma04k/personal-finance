import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Prisma 6.12 foundation", () => {
  it("loads the project Prisma config with the installed Prisma API", async () => {
    const { default: config } = await import("../../prisma.config");

    expect(config.schema).toBe("prisma/schema.prisma");
  });

  it("reads the database URL from the Prisma 6 datasource schema", async () => {
    const schema = await readFile("prisma/schema.prisma", "utf8");

    expect(schema).toMatch(
      /datasource\s+db\s*{[\s\S]*?url\s*=\s*env\("DATABASE_URL"\)/,
    );
  });
});
