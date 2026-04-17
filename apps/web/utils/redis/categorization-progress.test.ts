import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redis } from "@/utils/redis";
import {
  getCategorizationProgress,
  getCategorizationStatusSnapshot,
  saveCategorizationProgress,
  saveCategorizationTotalItems,
} from "@/utils/redis/categorization-progress";

vi.mock("@/utils/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe("categorization progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-16T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("overwrites total items while preserving completed progress and startedAt", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce({
      totalItems: 2,
      completedItems: 1,
      status: "running",
      startedAt: "2026-04-16T11:55:00.000Z",
      updatedAt: "2026-04-16T11:56:00.000Z",
    });

    await saveCategorizationTotalItems({
      emailAccountId: "account-1",
      totalItems: 4,
    });

    expect(redis.set).toHaveBeenCalledWith(
      "categorization-progress:account-1",
      {
        totalItems: 4,
        completedItems: 1,
        status: "running",
        startedAt: "2026-04-16T11:55:00.000Z",
        updatedAt: "2026-04-16T12:00:00.000Z",
      },
      { ex: 900 },
    );
  });

  it("marks progress completed when completedItems reaches totalItems", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce({
      totalItems: 4,
      completedItems: 3,
      status: "running",
      startedAt: "2026-04-16T11:55:00.000Z",
      updatedAt: "2026-04-16T11:59:00.000Z",
    });

    const progress = await saveCategorizationProgress({
      emailAccountId: "account-1",
      incrementCompleted: 2,
    });

    expect(progress).toEqual({
      totalItems: 4,
      completedItems: 4,
      status: "completed",
      startedAt: "2026-04-16T11:55:00.000Z",
      updatedAt: "2026-04-16T12:00:00.000Z",
    });
    expect(redis.set).toHaveBeenCalledWith(
      "categorization-progress:account-1",
      {
        totalItems: 4,
        completedItems: 4,
        status: "completed",
        startedAt: "2026-04-16T11:55:00.000Z",
        updatedAt: "2026-04-16T12:00:00.000Z",
      },
      { ex: 900 },
    );
  });

  it("returns null when no progress exists", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);

    const progress = await getCategorizationProgress({
      emailAccountId: "account-1",
    });

    expect(progress).toBeNull();
  });

  it("accepts legacy progress entries without status metadata", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce({
      totalItems: 4,
      completedItems: 4,
    });

    const progress = await getCategorizationProgress({
      emailAccountId: "account-1",
    });

    expect(progress).toEqual({
      totalItems: 4,
      completedItems: 4,
      status: "completed",
      startedAt: "2026-04-16T12:00:00.000Z",
      updatedAt: "2026-04-16T12:00:00.000Z",
    });
  });

  it("returns an idle snapshot when no progress exists", () => {
    expect(getCategorizationStatusSnapshot(null)).toEqual({
      status: "idle",
      totalItems: 0,
      completedItems: 0,
      remainingItems: 0,
      message: "Sender categorization has not started.",
    });
  });
});
