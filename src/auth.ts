import { buildAuthConfig } from "@/modules/auth/config/auth-config";
import { PrismaAuthUserRepository } from "@/modules/auth/infrastructure/prisma-auth-user-repository";

export const authOptions = buildAuthConfig(process.env, {
  users: new PrismaAuthUserRepository(),
});
