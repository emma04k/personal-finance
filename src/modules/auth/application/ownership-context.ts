import type { SafeSession } from "@/modules/auth/domain/session";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export class UserNotActiveError extends Error {
  constructor() {
    super("User is not active");
    this.name = "UserNotActiveError";
  }
}

export type OwnershipContext = {
  readonly userId: string;
  readonly role: "OWNER" | "MEMBER";
  readonly email: string;
};

export function requireOwnershipContext(
  session:
    | ({ readonly user?: SafeSession["user"] | null } & Partial<Pick<SafeSession, "expires">>)
    | null
    | undefined,
): OwnershipContext {
  if (!session?.user) throw new AuthenticationRequiredError();
  if (session.user.status !== "ACTIVE") throw new UserNotActiveError();

  return {
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email,
  };
}
