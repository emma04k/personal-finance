import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  type BootstrapDatabase,
  bootstrapInitialOwner,
  parseBootstrapOwnerArgs,
  runBootstrapFirstOwner,
} from "../../../scripts/bootstrap-first-owner";

describe("first-owner bootstrap", () => {
  it("parses explicitly confirmed owner input with the provider fixed to oidc", () => {
    expect(parseBootstrapOwnerArgs([
      "--subject", "auth0|owner-subject",
      "--email", "owner@example.test",
      "--display-name", "Initial Owner",
      "--confirm",
    ])).toEqual({
      providerAccountId: "auth0|owner-subject",
      email: "owner@example.test",
      displayName: "Initial Owner",
    });
  });

  it("rejects unconfirmed, malformed, and provider-override arguments", () => {
    expect(() => parseBootstrapOwnerArgs([
      "--subject", "auth0|owner-subject",
      "--email", "owner@example.test",
    ])).toThrow("Refusing to bootstrap without --confirm.");
    expect(() => parseBootstrapOwnerArgs([
      "--subject", "auth0|owner subject",
      "--email", "owner@example.test",
      "--confirm",
    ])).toThrow("A valid Auth0 OIDC subject is required.");
    expect(() => parseBootstrapOwnerArgs([
      "--subject", "auth0|owner-subject",
      "--email", "not-an-email",
      "--confirm",
    ])).toThrow("A valid email address is required.");
    expect(() => parseBootstrapOwnerArgs([
      "--subject", "auth0|owner-subject",
      "--email", "owner@example.test",
      "--provider", "google",
      "--confirm",
    ])).toThrow("Unknown bootstrap option.");
  });

  it("refuses to run without DATABASE_URL and does not construct a database client", async () => {
    const createDatabase = vi.fn();
    const writeError = vi.fn();

    await expect(runBootstrapFirstOwner([
      "--subject", "auth0|owner-subject",
      "--email", "owner@example.test",
      "--confirm",
    ], {
      env: {},
      createDatabase,
      output: { info: vi.fn(), error: writeError },
    })).resolves.toBe(1);

    expect(createDatabase).not.toHaveBeenCalled();
    expect(writeError).toHaveBeenCalledWith("Owner bootstrap failed: DATABASE_URL is required.");
  });

  it("reports successful provisioning without echoing the owner email or OIDC subject", async () => {
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "00000000-0000-0000-0000-000000000004",
          role: "OWNER" as const,
          status: "ACTIVE" as const,
        }),
      },
      oidcAccount: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const info = vi.fn();
    const error = vi.fn();

    await expect(runBootstrapFirstOwner([
      "--subject", "auth0|private-subject",
      "--email", "private@example.test",
      "--confirm",
    ], {
      env: { DATABASE_URL: "postgresql://not-printed" },
      createDatabase: () => ({
        $transaction: async (operation: (client: typeof transactionClient) => Promise<unknown>) => operation(transactionClient),
        $disconnect: disconnect,
      }) as unknown as BootstrapDatabase & { readonly $disconnect: () => Promise<void> },
      output: { info, error },
    })).resolves.toBe(0);

    expect(info).toHaveBeenCalledWith("Initial owner bootstrap succeeded: provider=oidc role=OWNER status=ACTIVE.");
    expect(JSON.stringify(info.mock.calls)).not.toContain("private@example.test");
    expect(JSON.stringify(info.mock.calls)).not.toContain("auth0|private-subject");
    expect(error).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("fails before loading Prisma when DATABASE_URL is absent from the process environment", () => {
    try {
      execFileSync(process.execPath, [
        "--experimental-strip-types",
        "scripts/bootstrap-first-owner.ts",
        "--subject", "auth0|test-subject",
        "--email", "test@example.test",
        "--confirm",
      ], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "" } as unknown as NodeJS.ProcessEnv,
        stdio: "pipe",
      });
      throw new Error("Expected the bootstrap command to fail without DATABASE_URL.");
    } catch (error) {
      const commandError = error as { readonly status?: number; readonly stderr?: string | Buffer };
      const stderr = commandError.stderr?.toString() ?? "";

      expect(commandError.status).toBe(1);
      expect(stderr).toContain("Owner bootstrap failed: DATABASE_URL is required.");
      expect(stderr).not.toContain("test@example.test");
      expect(stderr).not.toContain("auth0|test-subject");
    }
  });

  it("creates one active OWNER and its fixed oidc account in a serializable transaction", async () => {
    const userCreate = vi.fn().mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000001",
      role: "OWNER",
      status: "ACTIVE",
    });
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: userCreate,
      },
      oidcAccount: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const transaction = vi.fn(async (operation: (client: typeof transactionClient) => Promise<unknown>) =>
      operation(transactionClient),
    );

    await expect(bootstrapInitialOwner({ $transaction: transaction } as unknown as BootstrapDatabase, {
      providerAccountId: "auth0|owner-subject",
      email: "owner@example.test",
      displayName: "Initial Owner",
    })).resolves.toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      provider: "oidc",
      role: "OWNER",
      status: "ACTIVE",
    });

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(transactionClient.user.create).toHaveBeenCalledWith({
      data: {
        email: "owner@example.test",
        displayName: "Initial Owner",
        role: "OWNER",
        status: "ACTIVE",
        oidcAccounts: {
          create: {
            provider: "oidc",
            providerAccountId: "auth0|owner-subject",
          },
        },
      },
      select: { id: true, role: true, status: true },
    });
  });

  it("refuses to create a second active owner without writing an identity", async () => {
    const userCreate = vi.fn();
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: "00000000-0000-0000-0000-000000000001" }),
        findUnique: vi.fn(),
        create: userCreate,
      },
      oidcAccount: { findUnique: vi.fn() },
    };

    await expect(bootstrapInitialOwner({
      $transaction: async (operation) => operation(transactionClient),
    }, {
      providerAccountId: "auth0|second-subject",
      email: "second@example.test",
      displayName: null,
    })).rejects.toThrow("An active owner already exists.");

    expect(transactionClient.user.findUnique).not.toHaveBeenCalled();
    expect(transactionClient.oidcAccount.findUnique).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("rejects an email already assigned to a user without writing an identity", async () => {
    const userCreate = vi.fn();
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({ id: "00000000-0000-0000-0000-000000000002" }),
        create: userCreate,
      },
      oidcAccount: { findUnique: vi.fn() },
    };
    const transaction = vi.fn(async (operation: (client: typeof transactionClient) => Promise<unknown>) =>
      operation(transactionClient),
    );

    await expect(bootstrapInitialOwner({ $transaction: transaction } as unknown as BootstrapDatabase, {
      providerAccountId: "auth0|new-subject",
      email: "existing@example.test",
      displayName: null,
    })).rejects.toThrow("A user with this email already exists.");

    expect(transactionClient.oidcAccount.findUnique).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("rejects an OIDC subject already linked to an identity without writing a user", async () => {
    const userCreate = vi.fn();
    const transactionClient = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: userCreate,
      },
      oidcAccount: {
        findUnique: vi.fn().mockResolvedValue({ id: "00000000-0000-0000-0000-000000000003" }),
      },
    };
    const transaction = vi.fn(async (operation: (client: typeof transactionClient) => Promise<unknown>) =>
      operation(transactionClient),
    );

    await expect(bootstrapInitialOwner({ $transaction: transaction } as unknown as BootstrapDatabase, {
      providerAccountId: "auth0|linked-subject",
      email: "new@example.test",
      displayName: null,
    })).rejects.toThrow("An OIDC account with this subject already exists.");

    expect(userCreate).not.toHaveBeenCalled();
  });
});
