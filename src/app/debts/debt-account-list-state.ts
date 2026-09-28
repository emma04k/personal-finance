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
import type {
  OwnedPeriod,
  OwnedPlanningRepository,
} from "@/modules/budget/application/owned-planning-repository";
import type {
  OwnedDebtPaymentHistoryEntry,
  OwnedDebtPaymentRepository,
} from "@/modules/debt/application/owned-debt-payment-repository";
import { PrismaOwnedDebtAccountRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-account-repository";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";
import { PrismaOwnedDebtPaymentRepository } from "@/modules/debt/infrastructure/prisma-owned-debt-payment-repository";
import { prisma } from "@/lib/prisma";

export type DebtAccountListState =
  | Readonly<{
      status: "authenticated";
      accounts: readonly OwnedDebtAccount[];
      periods: readonly OwnedPeriod[];
      paymentHistory: readonly OwnedDebtPaymentHistoryEntry[];
    }>
  | Readonly<{ status: "authentication-required" }>;

type DebtAccountListStateDependencies = Readonly<{
  getOwner?: () => Promise<OwnershipContext>;
  repository?: Pick<OwnedDebtAccountRepository, "listActiveDebtAccountsForOwner">;
  planningRepository?: Pick<OwnedPlanningRepository, "listPeriodsForOwner">;
  paymentRepository?: Pick<OwnedDebtPaymentRepository, "listDebtPaymentsForOwner">;
}>;

export async function loadDebtAccountListState(
  dependencies: DebtAccountListStateDependencies = {},
): Promise<DebtAccountListState> {
  const getOwner = dependencies.getOwner ?? requireCurrentOwnershipContext;
  const repository = dependencies.repository ?? new PrismaOwnedDebtAccountRepository(prisma);
  const planningRepository = dependencies.planningRepository ?? new PrismaOwnedPlanningRepository(prisma);
  const paymentRepository = dependencies.paymentRepository ?? new PrismaOwnedDebtPaymentRepository(prisma);

  try {
    const owner = await getOwner();
    const [accounts, periods, paymentHistory] = await Promise.all([
      repository.listActiveDebtAccountsForOwner(owner.userId),
      planningRepository.listPeriodsForOwner(owner.userId),
      paymentRepository.listDebtPaymentsForOwner(owner.userId),
    ]);
    return { status: "authenticated", accounts, periods, paymentHistory };
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
