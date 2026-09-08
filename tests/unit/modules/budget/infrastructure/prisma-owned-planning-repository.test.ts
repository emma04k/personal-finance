import { describe, expect, it, vi } from "vitest";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";
const otherPeriodId = "10000000-0000-0000-0000-000000000002";
const otherCategoryId = "20000000-0000-0000-0000-000000000002";

describe("Prisma owner-scoped planning repository", () => {
  it("scopes period lookups by authenticated owner", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst },
      category: { findMany: vi.fn(), findFirst: vi.fn() },
    });

    await expect(repository.findPeriodForOwner(ownerUserId, otherPeriodId)).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: otherPeriodId, userId: ownerUserId },
    });
  });

  it("scopes active category lists by authenticated owner", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn() },
      category: { findMany, findFirst: vi.fn() },
    });

    await expect(repository.listActiveCategoriesForOwner(ownerUserId)).resolves.toEqual([]);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: ownerUserId, archivedAt: null },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  });

  it("scopes category lookups by authenticated owner", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn() },
      category: { findMany: vi.fn(), findFirst },
    });

    await expect(repository.findCategoryForOwner(ownerUserId, otherCategoryId)).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: otherCategoryId, userId: ownerUserId },
    });
  });
});
