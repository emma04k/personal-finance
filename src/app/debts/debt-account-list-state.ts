import {
  AuthenticationRequiredError,
  UserNotActiveError,
  type OwnershipContext,
} from "@/modules/auth/application/ownership-context";
import { requireCurrentOwnershipContext } from "@/modules/auth/application/current-ownership-context";
import type {
  OwnedDebtAccount,
  OwnedDebtAccountRepository,
} from "@/modules/debt/application/owned-debt-account-repository";
import { PrismaOwnedDebtAccountRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-account-repository";
import { prisma } from "@/lib/prisma";

export type DebtAccountListState =
  | Readonly<{
      status: "authenticated";
      accounts: readonly OwnedDebtAccount[];
    }>
  | Readonly<{ status: "authentication-required" }>;

type DebtAccountListStateDependencies = Readonly<{
  getOwner?: () => Promise<OwnershipContext>;
  repository?: Pick<OwnedDebtAccountRepository, "listActiveDebtAccountsForOwner">;
}>;

export async function loadDebtAccountListState(
  dependencies: DebtAccountListStateDependencies = {},
): Promise<DebtAccountListState> {
  const getOwner = dependencies.getOwner ?? requireCurrentOwnershipContext;
  const repository = dependencies.repository ?? new PrismaOwnedDebtAccountRepository(prisma);

  try {
    const owner = await getOwner();
    const accounts = await repository.listActiveDebtAccountsForOwner(owner.userId);
    return { status: "authenticated", accounts };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof UserNotActiveError
    ) {
      return { status: "authentication-required" };
    }

    throw error;
  }
}
