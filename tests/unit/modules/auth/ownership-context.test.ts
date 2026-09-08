import { describe, expect, it } from "vitest";
import {
  AuthenticationRequiredError,
  requireOwnershipContext,
  UserNotActiveError,
} from "@/modules/auth/application/ownership-context";

describe("authenticated ownership context", () => {
  it("denies unauthenticated access before repositories are called", () => {
    expect(() => requireOwnershipContext(null)).toThrow(AuthenticationRequiredError);
    expect(() => requireOwnershipContext({ user: undefined })).toThrow(AuthenticationRequiredError);
  });

  it("denies inactive session users", () => {
    expect(() =>
      requireOwnershipContext({
        user: {
          id: "00000000-0000-0000-0000-000000000002",
          email: "invited@example.test",
          name: "Invited User",
          role: "MEMBER",
          status: "INVITED",
        },
        expires: "2099-01-01T00:00:00.000Z",
      }),
    ).toThrow(UserNotActiveError);
  });

  it("derives owner id only from the server session", () => {
    const context = requireOwnershipContext({
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "owner@example.test",
        name: "Owner User",
        role: "OWNER",
        status: "ACTIVE",
      },
      expires: "2099-01-01T00:00:00.000Z",
    });

    expect(context).toEqual({
      userId: "00000000-0000-0000-0000-000000000001",
      role: "OWNER",
      email: "owner@example.test",
    });
  });
});
