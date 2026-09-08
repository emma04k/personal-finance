import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("auth environment example", () => {
  it("documents generic OIDC placeholders without real secrets", async () => {
    const envExample = await readFile(".env.example", "utf8");

    expect(envExample).toContain("AUTH_OIDC_ISSUER=");
    expect(envExample).toContain("AUTH_OIDC_CLIENT_ID=");
    expect(envExample).toContain("AUTH_OIDC_CLIENT_SECRET=");
    expect(envExample).toContain("NEXTAUTH_SECRET=");
    expect(envExample).not.toMatch(/sk-|ghp_|github_pat_|AKIA|BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY/);
  });
});
