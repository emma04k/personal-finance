import { describe, expect, it, vi } from "vitest";
import { DuplicateMonthlyPeriodError } from "@/modules/budget/application/owned-planning-repository";
import { PrismaOwnedPlanningRepository } from "@/modules/budget/infrastructure/prisma-owned-planning-repository";

const ownerUserId = "00000000-0000-0000-0000-000000000001";
const otherPeriodId = "10000000-0000-0000-0000-000000000002";
const otherCategoryId = "20000000-0000-0000-0000-000000000002";

describe("Prisma owner-scoped planning repository", () => {
  it("scopes period lookups by authenticated owner", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst, create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn() },
    });

    await expect(repository.findPeriodForOwner(ownerUserId, otherPeriodId)).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: otherPeriodId, userId: ownerUserId },
    });
  });

  it("scopes monthly period lookups by authenticated owner", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst, create: vi.fn() },
      category: { findMany: vi.fn(), findFirst: vi.fn() },
    });

    await expect(repository.findPeriodByMonthForOwner(ownerUserId, "2026-03-01")).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: ownerUserId, monthStart: new Date("2026-03-01T00:00:00.000Z") },
    });
  });

  it("creates periods with the authenticated owner id in Prisma data", async () => {
    const created = {
      id: "10000000-0000-0000-0000-000000000003",
      userId: ownerUserId,
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      currencyCode: "COP",
      timeZone: "America/Bogota",
      note: null,
    };
    const create = vi.fn().mockResolvedValue(created);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create },
      category: { findMany: vi.fn(), findFirst: vi.fn() },
    });

    await expect(
      repository.createPeriodForOwner(ownerUserId, {
        monthStart: "2026-03-01",
        currencyCode: "COP",
        timeZone: "America/Bogota",
        note: null,
      }),
    ).resolves.toEqual({ ...created, monthStart: "2026-03-01" });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: ownerUserId,
        monthStart: new Date("2026-03-01T00:00:00.000Z"),
        currencyCode: "COP",
        timeZone: "America/Bogota",
        note: null,
      },
    });
  });

  it("translates Prisma owner-month unique violations into duplicate monthly period errors", async () => {
    const create = vi.fn().mockRejectedValue({
      code: "P2002",
      meta: { target: ["userId", "monthStart"] },
    });
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create },
      category: { findMany: vi.fn(), findFirst: vi.fn() },
    });

    await expect(
      repository.createPeriodForOwner(ownerUserId, {
        monthStart: "2026-03-01",
        currencyCode: "COP",
        timeZone: "America/Bogota",
        note: null,
      }),
    ).rejects.toBeInstanceOf(DuplicateMonthlyPeriodError);
  });

  it("does not translate unrelated Prisma unique violations as monthly duplicates", async () => {
    const uniqueError = {
      code: "P2002",
      meta: { target: ["id", "userId"] },
    };
    const create = vi.fn().mockRejectedValue(uniqueError);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create },
      category: { findMany: vi.fn(), findFirst: vi.fn() },
    });

    await expect(
      repository.createPeriodForOwner(ownerUserId, {
        monthStart: "2026-03-01",
        currencyCode: "COP",
        timeZone: "America/Bogota",
        note: null,
      }),
    ).rejects.toBe(uniqueError);
  });

  it("scopes active category lists by authenticated owner", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaOwnedPlanningRepository({
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
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
      period: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      category: { findMany: vi.fn(), findFirst },
    });

    await expect(repository.findCategoryForOwner(ownerUserId, otherCategoryId)).resolves.toBeNull();

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: otherCategoryId, userId: ownerUserId },
    });
  });
});
