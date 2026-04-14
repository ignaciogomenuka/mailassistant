import { NextResponse } from "next/server";
import { withEmailAccount } from "@/utils/middleware";
import prisma from "@/utils/prisma";
import type { AttachmentSourceInput } from "@/utils/attachments/source-schema";

export type RulesResponse = Awaited<ReturnType<typeof getRules>>;

async function getRules({ emailAccountId }: { emailAccountId: string }) {
  const rules = await prisma.rule.findMany({
    where: { emailAccountId },
    include: {
      actions: true,
      group: { select: { name: true } },
      attachmentSources: {
        select: {
          id: true,
          driveConnection: { select: { isConnected: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const staticAttachmentConnectionIds = new Set<string>();
  for (const rule of rules) {
    for (const action of rule.actions) {
      const staticAttachments = Array.isArray(action.staticAttachments)
        ? (action.staticAttachments as AttachmentSourceInput[])
        : [];
      for (const attachment of staticAttachments) {
        if (attachment?.driveConnectionId) {
          staticAttachmentConnectionIds.add(attachment.driveConnectionId);
        }
      }
    }
  }

  const staticConnections = staticAttachmentConnectionIds.size
    ? await prisma.driveConnection.findMany({
        where: {
          emailAccountId,
          id: { in: [...staticAttachmentConnectionIds] },
        },
        select: { id: true, isConnected: true },
      })
    : [];

  const connectionStatusById = new Map(
    staticConnections.map((connection) => [connection.id, connection.isConnected]),
  );

  return rules.map((rule) => {
    const sourceDisconnected = rule.attachmentSources.some(
      (source) => source.driveConnection?.isConnected === false,
    );

    const staticDisconnected = rule.actions.some((action) => {
      const staticAttachments = Array.isArray(action.staticAttachments)
        ? (action.staticAttachments as AttachmentSourceInput[])
        : [];
      return staticAttachments.some((attachment) => {
        if (!attachment?.driveConnectionId) return false;
        const connected = connectionStatusById.get(attachment.driveConnectionId);
        // Treat missing connections (deleted) as disconnected too.
        return connected !== true;
      });
    });

    return {
      ...rule,
      hasDisconnectedDriveAttachments: sourceDisconnected || staticDisconnected,
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
