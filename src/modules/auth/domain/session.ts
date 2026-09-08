export type AuthUserRole = "OWNER" | "MEMBER";
export type AuthUserStatus = "INVITED" | "ACTIVE" | "SUSPENDED";

export type AuthUserRecord = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
};

export type SafeSessionUser = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
};

export type SafeSessionToken = {
  readonly appUser?: SafeSessionUser;
};

export type SafeSession = {
  readonly expires: string;
  readonly user?: SafeSessionUser;
};

export function toSafeSessionUser(user: AuthUserRecord): SafeSessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.displayName ?? user.email,
    role: user.role,
    status: user.status,
  };
}

export function applySafeUserToToken(
  _token: Record<string, unknown>,
  user: AuthUserRecord,
): SafeSessionToken {
  return { appUser: toSafeSessionUser(user) };
}

export function buildSafeSession(
  session: { readonly expires: string; readonly user?: unknown },
  token: SafeSessionToken | Record<string, unknown>,
): SafeSession {
  const appUser = (token as SafeSessionToken).appUser;
  if (!appUser) return { expires: session.expires };

  return {
    expires: session.expires,
    user: appUser,
  };
}
