import { prisma } from "@/lib/prisma";
import type { AuthUserRepository } from "@/modules/auth/config/auth-config";

export class PrismaAuthUserRepository implements AuthUserRepository {
  async findActiveUserByOidcAccount(provider: string, providerAccountId: string) {
    const account = await prisma.oidcAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (account?.user.status !== "ACTIVE") return null;

    return account.user;
  }
}
