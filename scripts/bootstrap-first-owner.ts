import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type BootstrapOwnerInput = {
  readonly providerAccountId: string;
  readonly email: string;
  readonly displayName: string | null;
};

type ExistingRecord = { readonly id: string } | null;
type CreatedOwner = {
  readonly id: string;
  readonly role: "OWNER";
  readonly status: "ACTIVE";
};

export type BootstrapTransactionClient = {
  readonly user: {
    readonly findFirst: (args: Record<string, unknown>) => Promise<ExistingRecord>;
    readonly findUnique: (args: Record<string, unknown>) => Promise<ExistingRecord>;
    readonly create: (args: Record<string, unknown>) => Promise<CreatedOwner>;
  };
  readonly oidcAccount: {
    readonly findUnique: (args: Record<string, unknown>) => Promise<ExistingRecord>;
  };
};

export type BootstrapDatabase = {
  readonly $transaction: <T>(
    operation: (transaction: BootstrapTransactionClient) => Promise<T>,
    options: { readonly isolationLevel: "Serializable" },
  ) => Promise<T>;
};

export function parseBootstrapOwnerArgs(args: readonly string[]): BootstrapOwnerInput {
  let providerAccountId: string | undefined;
  let email: string | undefined;
  let displayName: string | null = null;
  let confirmed = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--confirm") {
      if (confirmed) throw new Error("The --confirm flag may be provided only once.");
      confirmed = true;
      continue;
    }

    if (argument !== "--subject" && argument !== "--email" && argument !== "--display-name") {
      throw new Error("Unknown bootstrap option.");
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}.`);
    index += 1;

    if (argument === "--subject") {
      if (providerAccountId !== undefined) throw new Error("The --subject option may be provided only once.");
      providerAccountId = value;
    } else if (argument === "--email") {
      if (email !== undefined) throw new Error("The --email option may be provided only once.");
      email = value;
    } else {
      if (displayName !== null) throw new Error("The --display-name option may be provided only once.");
      displayName = value;
    }
  }

  if (!confirmed) throw new Error("Refusing to bootstrap without --confirm.");
  if (!providerAccountId || providerAccountId.length > 191 || /\s|[\u0000-\u001F\u007F]/u.test(providerAccountId)) {
    throw new Error("A valid Auth0 OIDC subject is required.");
  }
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error("A valid email address is required.");
  }
  if (displayName !== null && (displayName.length === 0 || displayName.length > 120 || /[\u0000-\u001F\u007F]/u.test(displayName))) {
    throw new Error("The display name must be between 1 and 120 non-control characters.");
  }

  return { providerAccountId, email, displayName };
}

export type BootstrapRunDependencies = {
  readonly env: { readonly DATABASE_URL?: string };
  readonly createDatabase: () => BootstrapDatabase & { readonly $disconnect?: () => Promise<void> };
  readonly output: { readonly info: (message: string) => void; readonly error: (message: string) => void };
};

const safeBootstrapErrors = new Set([
  "An active owner already exists.",
  "A user with this email already exists.",
  "An OIDC account with this subject already exists.",
]);

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && safeBootstrapErrors.has(error.message)) return error.message;
  return "Database operation failed without creating an owner.";
}

export async function runBootstrapFirstOwner(
  args: readonly string[],
  dependencies: BootstrapRunDependencies,
): Promise<0 | 1> {
  let input: BootstrapOwnerInput;
  try {
    input = parseBootstrapOwnerArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid command input.";
    dependencies.output.error(`Owner bootstrap failed: ${message}`);
    return 1;
  }

  if (!dependencies.env.DATABASE_URL) {
    dependencies.output.error("Owner bootstrap failed: DATABASE_URL is required.");
    return 1;
  }

  let database: (BootstrapDatabase & { readonly $disconnect?: () => Promise<void> }) | undefined;
  try {
    database = dependencies.createDatabase();
    const owner = await bootstrapInitialOwner(database, input);
    dependencies.output.info(`Initial owner bootstrap succeeded: provider=${owner.provider} role=${owner.role} status=${owner.status}.`);
    return 0;
  } catch (error) {
    dependencies.output.error(`Owner bootstrap failed: ${safeErrorMessage(error)}`);
    return 1;
  } finally {
    await database?.$disconnect?.();
  }
}

export async function bootstrapInitialOwner(
  database: BootstrapDatabase,
  input: BootstrapOwnerInput,
) {
  return database.$transaction(async (transaction) => {
    const existingOwner = await transaction.user.findFirst({
      where: { role: "OWNER", status: "ACTIVE" },
      select: { id: true },
    });
    if (existingOwner) throw new Error("An active owner already exists.");

    const existingEmail = await transaction.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existingEmail) throw new Error("A user with this email already exists.");

    const existingOidcAccount = await transaction.oidcAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "oidc",
          providerAccountId: input.providerAccountId,
        },
      },
      select: { id: true },
    });
    if (existingOidcAccount) throw new Error("An OIDC account with this subject already exists.");

    const owner = await transaction.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        role: "OWNER",
        status: "ACTIVE",
        oidcAccounts: {
          create: {
            provider: "oidc",
            providerAccountId: input.providerAccountId,
          },
        },
      },
      select: { id: true, role: true, status: true },
    });

    return { id: owner.id, provider: "oidc" as const, role: owner.role, status: owner.status };
  }, { isolationLevel: "Serializable" });
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("Owner bootstrap failed: DATABASE_URL is required.");
    process.exitCode = 1;
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const exitCode = await runBootstrapFirstOwner(process.argv.slice(2), {
    env: { DATABASE_URL: process.env.DATABASE_URL },
    createDatabase: () => new PrismaClient() as unknown as BootstrapDatabase & {
      readonly $disconnect: () => Promise<void>;
    },
    output: { info: console.log, error: console.error },
  });
  process.exitCode = exitCode;
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  void main();
}
