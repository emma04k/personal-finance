import { describe, expect, it } from "vitest";
import {
  buildAuthConfig,
  getOidcProviderSettings,
  isPublicRegistrationEnabled,
} from "@/modules/auth/config/auth-config";
import type { AuthUserRecord } from "@/modules/auth/domain/session";

const completeOidcEnv = {
  AUTH_OIDC_ISSUER: "https://issuer.example.test",
  AUTH_OIDC_CLIENT_ID: "client-id-from-env",
  AUTH_OIDC_CLIENT_SECRET: "client-secret-from-env",
};

const activeUser: AuthUserRecord = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "owner@example.test",
  displayName: "Owner User",
  role: "OWNER",
  status: "ACTIVE",
};

describe("Auth.js OIDC configuration boundary", () => {
  it("builds a generic OIDC provider from environment settings", () => {
    const provider = getOidcProviderSettings(completeOidcEnv);

    expect(provider).toEqual({
      id: "oidc",
      name: "OIDC",
      issuer: "https://issuer.example.test",
      wellKnown: "https://issuer.example.test/.well-known/openid-configuration",
      clientId: "client-id-from-env",
      clientSecret: "client-secret-from-env",
      authorization: { params: { scope: "openid email profile" } },
      checks: ["pkce", "state"],
    });
  });

  it("configures enabled OIDC provider with Auth.js discovery metadata", () => {
    const config = buildAuthConfig(
      {
        ...completeOidcEnv,
        AUTH_OIDC_ISSUER: "https://issuer.example.test/",
      },
      { users: { findActiveUserByOidcAccount: async () => activeUser } },
    );

    const [provider] = config.providers as unknown as Array<Record<string, unknown>>;

    expect(provider?.wellKnown).toBe(
      "https://issuer.example.test/.well-known/openid-configuration",
    );
  });

  it("omits providers when OIDC environment settings are incomplete", () => {
    expect(getOidcProviderSettings({ AUTH_OIDC_ISSUER: "https://issuer.example.test" })).toBeNull();

    const config = buildAuthConfig(
      { AUTH_OIDC_ISSUER: "https://issuer.example.test" },
      { users: { findActiveUserByOidcAccount: async () => activeUser } },
    );

    expect(config.providers).toEqual([]);
  });

  it("does not enable password auth or public registration", () => {
    const config = buildAuthConfig(completeOidcEnv, {
      users: { findActiveUserByOidcAccount: async () => activeUser },
    });

    expect(isPublicRegistrationEnabled()).toBe(false);
    expect(JSON.stringify(config.providers).toLowerCase()).not.toContain("credentials");
    expect(JSON.stringify(config.providers).toLowerCase()).not.toContain("password");
  });

  it("denies OIDC sign in when the provider account is not pre-provisioned", async () => {
    const config = buildAuthConfig(completeOidcEnv, {
      users: { findActiveUserByOidcAccount: async () => null },
    });

    const result = await config.callbacks?.signIn?.({
      account: {
        provider: "oidc",
        providerAccountId: "uninvited-subject",
        type: "oauth",
      },
      user: { id: "provider-user", email: "uninvited@example.test", emailVerified: null },
      profile: {},
      email: { verificationRequest: false },
      credentials: {},
    });

    expect(result).toBe(false);
  });

  it("allows OIDC sign in for an active pre-provisioned account", async () => {
    const config = buildAuthConfig(completeOidcEnv, {
      users: { findActiveUserByOidcAccount: async () => activeUser },
    });

    const result = await config.callbacks?.signIn?.({
      account: {
        provider: "oidc",
        providerAccountId: "linked-subject",
        type: "oauth",
      },
      user: { id: "provider-user", email: activeUser.email, emailVerified: null },
      profile: {},
      email: { verificationRequest: false },
      credentials: {},
    });

    expect(result).toBe(true);
  });
});
