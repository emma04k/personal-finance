import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, proxy } from "../../src/proxy";

const rootLayout = readFileSync(resolve("src/app/layout.tsx"), "utf8");

const requiredDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "upgrade-insecure-requests",
] as const;

describe("Content Security Policy", () => {
  it("returns a strict nonce-based production policy", () => {
    const policy = buildContentSecurityPolicy("test-nonce", false);

    for (const directive of requiredDirectives) {
      expect(policy).toContain(`${directive};`);
    }
    expect(policy).toContain(
      "script-src 'self' 'nonce-test-nonce' 'strict-dynamic';",
    );
    expect(policy).toContain("style-src 'self' 'nonce-test-nonce';");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/[\r\n]/);
  });

  it("keeps unsafe-eval conditional to development", () => {
    const developmentPolicy = buildContentSecurityPolicy("test-nonce", true);
    const productionPolicy = buildContentSecurityPolicy("test-nonce", false);

    expect(developmentPolicy).toContain(
      "script-src 'self' 'nonce-test-nonce' 'strict-dynamic' 'unsafe-eval';",
    );
    expect(productionPolicy).not.toContain("'unsafe-eval'");
  });

  it("sets matching request and response policies with a fresh nonce", () => {
    const firstResponse = proxy(new NextRequest("https://example.test/"));
    const secondResponse = proxy(new NextRequest("https://example.test/"));
    const firstPolicy = firstResponse.headers.get("content-security-policy");
    const secondPolicy = secondResponse.headers.get("content-security-policy");

    expect(firstPolicy).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(firstResponse.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
    expect(firstResponse.headers.get("x-middleware-request-content-security-policy")).toBe(
      firstPolicy,
    );
    expect(secondPolicy).not.toBe(firstPolicy);
  });

  it("opts the application into request-time rendering for per-request nonces", () => {
    expect(rootLayout).toMatch(/import\s*\{\s*connection\s*\}\s*from\s*["']next\/server["']/);
    expect(rootLayout).toMatch(/await\s+connection\(\)/);
  });
});
