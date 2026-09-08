import type { OAuthConfig } from "next-auth/providers/oauth";
import type { NextAuthOptions } from "next-auth";
import {
  applySafeUserToToken,
  buildSafeSession,
  type AuthUserRecord,
} from "@/modules/auth/domain/session";

export type OidcProviderSettings = {
  id: "oidc";
  name: "OIDC";
  issuer: string;
  wellKnown: string;
  clientId: string;
  clientSecret: string;
  authorization: { params: { scope: "openid email profile" } };
  checks: ["pkce", "state"];
};

export type AuthUserRepository = {
  readonly findActiveUserByOidcAccount: (
    provider: string,
    providerAccountId: string,
  ) => Promise<AuthUserRecord | null>;
};

type OidcProfile = {
  readonly sub?: string;
  readonly email?: string;
  readonly name?: string;
  readonly preferred_username?: string;
};

type AuthEnvironment = Partial<Record<"AUTH_OIDC_ISSUER" | "AUTH_OIDC_CLIENT_ID" | "AUTH_OIDC_CLIENT_SECRET" | "NEXTAUTH_SECRET" | "AUTH_SECRET", string>>;

const oidcKeys = [
  "AUTH_OIDC_ISSUER",
  "AUTH_OIDC_CLIENT_ID",
  "AUTH_OIDC_CLIENT_SECRET",
] as const;

function normalizeIssuer(issuer: string): string {
  return issuer.replace(/\/+$/, "");
}

export function getOidcProviderSettings(env: AuthEnvironment): OidcProviderSettings | null {
  if (oidcKeys.some((key) => !env[key])) return null;

  const issuer = normalizeIssuer(env.AUTH_OIDC_ISSUER as string);

  return {
    id: "oidc",
    name: "OIDC",
    issuer,
    wellKnown: `${issuer}/.well-known/openid-configuration`,
    clientId: env.AUTH_OIDC_CLIENT_ID as string,
    clientSecret: env.AUTH_OIDC_CLIENT_SECRET as string,
    authorization: { params: { scope: "openid email profile" } },
    checks: ["pkce", "state"],
  };
}

export function isPublicRegistrationEnabled() {
  return false;
}

function createOidcProvider(settings: OidcProviderSettings): OAuthConfig<OidcProfile> {
  return {
    ...settings,
    type: "oauth",
    idToken: true,
    profile(profile) {
      return {
        id: profile.sub ?? profile.email ?? "oidc-user",
        email: profile.email,
        name: profile.name ?? profile.preferred_username ?? profile.email,
      };
    },
  };
}

export function buildAuthConfig(
  env: AuthEnvironment,
  dependencies: { readonly users: AuthUserRepository },
): NextAuthOptions {
  const oidcSettings = getOidcProviderSettings(env);

  return {
    providers: oidcSettings ? [createOidcProvider(oidcSettings)] : [],
    secret: env.AUTH_SECRET ?? env.NEXTAUTH_SECRET,
    session: { strategy: "jwt" },
    callbacks: {
      async signIn({ account }) {
        if (!account?.provider || !account.providerAccountId) return false;

        const user = await dependencies.users.findActiveUserByOidcAccount(
          account.provider,
          account.providerAccountId,
        );
        return user?.status === "ACTIVE";
      },
      async jwt({ token, account }) {
        if (!account?.provider || !account.providerAccountId) return token;

        const user = await dependencies.users.findActiveUserByOidcAccount(
          account.provider,
          account.providerAccountId,
        );
        if (!user) return {};

        return applySafeUserToToken(token, user);
      },
      async session({ session, token }) {
        return buildSafeSession(session, token as Record<string, unknown>);
      },
    },
  };
}
