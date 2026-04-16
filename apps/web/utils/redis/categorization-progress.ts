import { z } from "zod";
import { redis } from "@/utils/redis";

const CATEGORIZATION_PROGRESS_TTL_SECONDS = 15 * 60;

const categorizationProgressSchema = z.object({
  totalItems: z.number().int().min(0),
  completedItems: z.number().int().min(0),
  status: z.enum(["running", "completed"]),
  startedAt: z.string(),
  updatedAt: z.string(),
});

export type CategorizationProgress = z.infer<
  typeof categorizationProgressSchema
>;

export type CategorizationStatusSnapshot = {
  status: "idle" | "running" | "completed";
  totalItems: number;
  completedItems: number;
  remainingItems: number;
  message: string;
};

function getKey({ emailAccountId }: { emailAccountId: string }) {
  return `categorization-progress:${emailAccountId}`;
}

export async function getCategorizationProgress({
  emailAccountId,
}: {
  emailAccountId: string;
}) {
  const key = getKey({ emailAccountId });
  const progress = await redis.get<CategorizationProgress>(key);
  if (!progress) return null;
  return categorizationProgressSchema.parse(progress);
}

export async function saveCategorizationTotalItems({
  emailAccountId,
  totalItems,
}: {
  emailAccountId: string;
  totalItems: number;
}) {
  const key = getKey({ emailAccountId });
  const existingProgress = await getCategorizationProgress({ emailAccountId });
  const timestamp = new Date().toISOString();
  await redis.set(
    key,
    {
      totalItems,
      completedItems: existingProgress?.completedItems || 0,
      status: "running",
      startedAt: existingProgress?.startedAt || timestamp,
      updatedAt: timestamp,
    },
    { ex: CATEGORIZATION_PROGRESS_TTL_SECONDS },
  );
}

export async function saveCategorizationProgress({
  emailAccountId,
  incrementCompleted,
}: {
  emailAccountId: string;
  incrementCompleted: number;
}) {
  const existingProgress = await getCategorizationProgress({ emailAccountId });
  if (!existingProgress) return null;

  const key = getKey({ emailAccountId });
  const completedItems = Math.min(
    existingProgress.totalItems,
    existingProgress.completedItems + incrementCompleted,
  );
  const updatedProgress: CategorizationProgress = {
    ...existingProgress,
    completedItems,
    status:
      completedItems >= existingProgress.totalItems ? "completed" : "running",
    updatedAt: new Date().toISOString(),
  };

  await redis.set(key, updatedProgress, {
    ex: CATEGORIZATION_PROGRESS_TTL_SECONDS,
  });
  return updatedProgress;
}

export async function deleteCategorizationProgress({
  emailAccountId,
}: {
  emailAccountId: string;
}) {
  const key = getKey({ emailAccountId });
  await redis.del(key);
}

export function getCategorizationStatusSnapshot(
  progress: CategorizationProgress | null,
): CategorizationStatusSnapshot {
  if (!progress) {
    return {
      status: "idle",
      totalItems: 0,
      completedItems: 0,
      remainingItems: 0,
      message: "Sender categorization has not started.",
    };
  }

  const completedItems = Math.min(progress.completedItems, progress.totalItems);
  const remainingItems = Math.max(progress.totalItems - completedItems, 0);

  if (progress.status === "completed" || remainingItems === 0) {
    return {
      status: "completed",
      totalItems: progress.totalItems,
      completedItems,
      remainingItems: 0,
      message:
        progress.totalItems > 0
          ? `Sender categorization completed for ${completedItems} senders.`
          : "Sender categorization completed.",
    };
  }

  return {
    status: "running",
    totalItems: progress.totalItems,
    completedItems,
    remainingItems,
    message: `Categorizing senders: ${completedItems} of ${progress.totalItems} completed.`,
  };
}
