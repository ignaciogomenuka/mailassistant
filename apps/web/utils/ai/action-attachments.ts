import type { ExecutedRule } from "@/generated/prisma/client";
import { AttachmentSourceType } from "@/generated/prisma/enums";
import {
  type SelectedAttachment,
  attachmentSourceInputSchema,
} from "@/utils/attachments/source-schema";
import {
  resolveDraftAttachments,
  selectDraftAttachmentsForRule,
} from "@/utils/attachments/draft-attachments";
import type { ActionItem, EmailForAction } from "@/utils/ai/types";
import type { Logger } from "@/utils/logger";
import { getReplyWithConfidence } from "@/utils/redis/reply";
import { getEmailAccountWithAi } from "@/utils/user/get";
import { stringifyEmail } from "@/utils/stringify-email";
import { getEmailForLLM } from "@/utils/get-email-from-message";
import type { ParsedMessage } from "@/utils/types";

export async function resolveActionAttachments({
  email,
  emailAccountId,
  executedRule,
  userId,
  logger,
  staticAttachments,
  includeAiSelectedAttachments,
}: {
  email: EmailForAction;
  emailAccountId: string;
  executedRule: ExecutedRule;
  userId: string;
  logger: Logger;
  staticAttachments?: ActionItem["staticAttachments"];
  includeAiSelectedAttachments: boolean;
}) {
  const [aiSelectedAttachments, staticSelected] = await Promise.all([
    includeAiSelectedAttachments
      ? getDraftSelectedAttachments({
          email,
          emailAccountId,
          executedRule,
          logger,
        })
      : Promise.resolve([]),
    Promise.resolve(parseStaticAttachments(staticAttachments)),
  ]);

  const allSelected = [
    ...new Map(
      [...aiSelectedAttachments, ...staticSelected].map((attachment) => [
        `${attachment.driveConnectionId}:${attachment.fileId}`,
        attachment,
      ]),
    ).values(),
  ];

  if (allSelected.length === 0) return [];

  const attachments = await resolveDraftAttachments({
    emailAccountId,
    userId,
    selectedAttachments: allSelected,
    logger,
  });

  if (attachments.length === 0) {
    logger.warn("Selected rule attachments could not be resolved", {
      messageId: email.id,
      ruleId: executedRule.ruleId,
      selectedAttachmentCount: allSelected.length,
    });
  }

  return attachments;
}

async function getDraftSelectedAttachments({
  email,
  emailAccountId,
  executedRule,
  logger,
}: {
  email: EmailForAction;
  emailAccountId: string;
  executedRule: ExecutedRule;
  logger: Logger;
}): Promise<SelectedAttachment[]> {
  if (!executedRule.ruleId) return [];
  const ruleId = executedRule.ruleId;

  const cachedDraft = await getReplyWithConfidence({
    emailAccountId,
    messageId: email.id,
    ruleId,
  });

  if (cachedDraft) {
    return cachedDraft.attachments ?? [];
  }

  logger.info("Draft attachment cache missing, re-running selection", {
    messageId: email.id,
    ruleId,
  });

  const emailAccount = await getEmailAccountWithAi({ emailAccountId });
  if (!emailAccount) return [];

  const emailContent = stringifyEmail(
    getEmailForLLM(email as ParsedMessage),
    10_000,
  );

  try {
    const { selectedAttachments } = await selectDraftAttachmentsForRule({
      emailAccount,
      ruleId,
      emailContent,
      logger,
    });
    return selectedAttachments;
  } catch (error) {
    logger.error("Failed to select draft attachments on cache miss", {
      messageId: email.id,
      ruleId,
      error,
    });
    return [];
  }
}

function parseStaticAttachments(raw: unknown): SelectedAttachment[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];

  const parsed = attachmentSourceInputSchema.array().safeParse(raw);

  if (!parsed.success) return [];

  return parsed.data
    .filter((item) => item.type === AttachmentSourceType.FILE)
    .map((item) => ({
      driveConnectionId: item.driveConnectionId,
      fileId: item.sourceId,
      filename: item.name,
      mimeType: "application/pdf",
    }));
}
