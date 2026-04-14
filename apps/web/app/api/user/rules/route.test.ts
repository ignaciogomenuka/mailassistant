vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/utils/__mocks__/prisma";

vi.mock("@/utils/prisma");
vi.mock("@/utils/middleware", () => ({
  withEmailAccount:
    (
      _scope: string,
      handler: (request: NextRequest, ...args: unknown[]) => Promise<Response>,
    ) =>
    (request: NextRequest, ...args: unknown[]) =>
      handler(
        request as NextRequest & {
          auth: { emailAccountId: string };
          logger: { error: (...args: unknown[]) => void };
        },
        ...args,
      ),
}));

import { GET } from "./route";

function makeRequest(emailAccountId = "account-1") {
  const request = new NextRequest("http://localhost:3000/api/user/rules");
  (
    request as NextRequest & {
      auth: { emailAccountId: string };
      logger: { error: (...args: unknown[]) => void };
    }
  ).auth = { emailAccountId };
  (
    request as NextRequest & {
      auth: { emailAccountId: string };
      logger: { error: (...args: unknown[]) => void };
    }
  ).logger = { error: vi.fn() };
  return request;
}

describe("GET /api/user/rules — disconnected Drive signal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flags rules whose AttachmentSource has a disconnected DriveConnection", async () => {
    prisma.rule.findMany.mockResolvedValue([
      {
        id: "rule-connected",
        name: "Connected rule",
        actions: [],
        attachmentSources: [
          {
            id: "src-connected",
            driveConnection: { isConnected: true },
          },
        ],
      },
      {
        id: "rule-disconnected",
        name: "Disconnected rule",
        actions: [],
        attachmentSources: [
          {
            id: "src-disconnected",
            driveConnection: { isConnected: false },
          },
        ],
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.rule.findMany>>);

    const response = await GET(makeRequest(), {} as never);
    const body = (await response.json()) as Array<{
      id: string;
      hasDisconnectedDriveAttachments: boolean;
    }>;

    const connected = body.find((r) => r.id === "rule-connected");
    const disconnected = body.find((r) => r.id === "rule-disconnected");

    expect(connected?.hasDisconnectedDriveAttachments).toBe(false);
    expect(disconnected?.hasDisconnectedDriveAttachments).toBe(true);
  });

  it("flags rules whose static attachment references a disconnected DriveConnection", async () => {
    prisma.rule.findMany.mockResolvedValue([
      {
        id: "rule-static-disconnected",
        name: "Static disconnected",
        actions: [
          {
            id: "action-1",
            staticAttachments: [
              {
                driveConnectionId: "drive-gone",
                name: "lease.pdf",
                sourceId: "file-1",
                sourcePath: null,
                type: "FILE",
              },
            ],
          },
        ],
        attachmentSources: [],
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.rule.findMany>>);

    prisma.driveConnection.findMany.mockResolvedValue([
      {
        id: "drive-gone",
        isConnected: false,
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.driveConnection.findMany>>);

    const response = await GET(makeRequest(), {} as never);
    const body = (await response.json()) as Array<{
      id: string;
      hasDisconnectedDriveAttachments: boolean;
    }>;

    expect(body[0]?.hasDisconnectedDriveAttachments).toBe(true);
  });

  it("returns false when all Drive connections are present and connected", async () => {
    prisma.rule.findMany.mockResolvedValue([
      {
        id: "rule-ok",
        name: "All good",
        actions: [],
        attachmentSources: [],
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.rule.findMany>>);

    const response = await GET(makeRequest(), {} as never);
    const body = (await response.json()) as Array<{
      id: string;
      hasDisconnectedDriveAttachments: boolean;
    }>;

    expect(body[0]?.hasDisconnectedDriveAttachments).toBe(false);
  });
});
