import { NextResponse } from "next/server";
import { withEmailAccount } from "@/utils/middleware";
import prisma from "@/utils/prisma";
import { attachmentSourceInputSchema } from "@/utils/attachments/source-schema";

export type RulesResponse = Awaited<ReturnType<typeof getRules>>;

async function getRules({ emailAccountId }: { emailAccountId: string }) {
  const [rules, driveConnections] = await Promise.all([
    prisma.rule.findMany({
      where: { emailAccountId },
      include: {
        actions: true,
        group: { select: { name: true } },
        attachmentSources: {
          select: {
            id: true,
            driveConnection: { select: { id: true, isConnected: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.driveConnection.findMany({
      where: { emailAccountId },
      select: { id: true, isConnected: true },
    }),
  ]);

  const connectedDriveIds = new Set(
    driveConnections.filter((c) => c.isConnected).map((c) => c.id),
  );

  return rules.map((rule) => {
    const hasDisconnectedSourceAttachments = rule.attachmentSources.some(
      (source) => !source.driveConnection?.isConnected,
    );

    const hasDisconnectedStaticAttachments = rule.actions.some((action) => {
      if (!action.staticAttachments) return false;
      const parsed = attachmentSourceInputSchema
        .array()
        .safeParse(action.staticAttachments);
      if (!parsed.success) return false;
      return parsed.data.some(
        (attachment) => !connectedDriveIds.has(attachment.driveConnectionId),
      );
    });

    return {
      ...rule,
      hasDisconnectedDriveAttachments:
        hasDisconnectedSourceAttachments || hasDisconnectedStaticAttachments,
    };
  });
}

export const GET = withEmailAccount(
  "user/rules",
  async (request) => {
    const emailAccountId = request.auth.emailAccountId;

    try {
      const result = await getRules({ emailAccountId });
      return NextResponse.json(result);
    } catch (error) {
      request.logger.error("Error fetching rules", {
        error,
      });
      return NextResponse.json(
        { error: "Failed to fetch rules" },
        { status: 500 },
      );
    }
  },
  { requestTiming: {} },
);
