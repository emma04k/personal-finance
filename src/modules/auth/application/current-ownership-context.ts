import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  requireOwnershipContext,
  type OwnershipContext,
} from "@/modules/auth/application/ownership-context";

export async function requireCurrentOwnershipContext(): Promise<OwnershipContext> {
  const session = await getServerSession(authOptions);
  return requireOwnershipContext(session as Parameters<typeof requireOwnershipContext>[0]);
}
