import { describe, expect, it } from "vitest";
import {
  applySafeUserToToken,
  buildSafeSession,
  toSafeSessionUser,
  type AuthUserRecord,
} from "@/modules/auth/domain/session";

const databaseUserWithSensitiveFields = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "owner@example.test",
  displayName: "Owner User",
  role: "OWNER",
  status: "ACTIVE",
  passwordHash: "must-never-exist-or-leak",
  recoveryToken: "reset-secret",
  accessToken: "provider-access-token",
  refreshToken: "provider-refresh-token",
  oidcAccounts: [{ access_token: "nested-provider-token" }],
} satisfies AuthUserRecord & Record<string, unknown>;

describe("safe session DTO", () => {
  it("exposes only app-safe user fields", () => {
    const safeUser = toSafeSessionUser(databaseUserWithSensitiveFields);

    expect(safeUser).toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      email: "owner@example.test",
      name: "Owner User",
      role: "OWNER",
      status: "ACTIVE",
    });
    expect(JSON.stringify(safeUser)).not.toMatch(/password|token|secret|oidc|provider/i);
  });

  it("copies only safe fields into Auth.js JWT state", () => {
    const token = applySafeUserToToken(
      { accessToken: "provider-token", refreshToken: "provider-refresh-token" },
      databaseUserWithSensitiveFields,
    );

    expect(token).toEqual({
      appUser: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "owner@example.test",
        name: "Owner User",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    expect(JSON.stringify(token)).not.toMatch(/provider-token|refresh-token|password|secret/i);
  });

  it("builds a safe Auth.js session response", () => {
    const session = buildSafeSession(
      { user: { email: "profile@example.test" }, expires: "2099-01-01T00:00:00.000Z" },
      {
        appUser: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "owner@example.test",
          name: "Owner User",
          role: "OWNER",
          status: "ACTIVE",
        },
        accessToken: "provider-token",
      },
    );

    expect(session).toEqual({
      expires: "2099-01-01T00:00:00.000Z",
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "owner@example.test",
        name: "Owner User",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    expect(JSON.stringify(session)).not.toMatch(/provider-token|password|secret|oidc/i);
  });
});
