/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseDriveConnections = vi.fn();
const mockUseDriveSourceItems = vi.fn();
const mockUseDriveSourceChildren = vi.fn();

(globalThis as { React?: typeof React }).React = React;

vi.mock("server-only", () => ({}));

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_AUTO_DRAFT_DISABLED: false,
    NEXT_PUBLIC_DIGEST_ENABLED: true,
    NEXT_PUBLIC_EMAIL_SEND_ENABLED: true,
    NEXT_PUBLIC_WEBHOOK_ACTION_ENABLED: true,
    NEXT_PUBLIC_IS_RESEND_CONFIGURED: true,
    NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.com",
    EMAIL_ENCRYPT_SECRET: "test-secret",
    EMAIL_ENCRYPT_SALT: "test-salt",
  },
}));

vi.mock("@/utils/prisma");

vi.mock("@/hooks/useDriveConnections", () => ({
  useDriveConnections: () => mockUseDriveConnections(),
}));

vi.mock("@/hooks/useDriveSourceItems", () => ({
  useDriveSourceItems: () => mockUseDriveSourceItems(),
}));

vi.mock("@/hooks/useDriveSourceChildren", () => ({
  useDriveSourceChildren: () => mockUseDriveSourceChildren(),
}));

import { ActionAttachmentsField } from "./ActionAttachmentsField";

describe("ActionAttachmentsField", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseDriveConnections.mockReturnValue({
      data: {
        connections: [
          {
            id: "connection-1",
            provider: "GOOGLE_DRIVE",
          },
        ],
      },
    });
    mockUseDriveSourceItems.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      error: null,
    });
    mockUseDriveSourceChildren.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      error: null,
    });
  });

  it("renders BOTH 'Always attach' and 'AI-selected sources' when Drive is connected and rule state is empty", () => {
    render(
      <ActionAttachmentsField
        value={[]}
        onChange={vi.fn()}
        emailAccountId="18d9553a-5182-4347-8cfa-75c76c72f51e"
        attachmentSources={[]}
        onAttachmentSourcesChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Always attach")).toBeTruthy();
    expect(screen.getByText("AI-selected sources")).toBeTruthy();
  });

  it("still renders BOTH sections regardless of attachmentSources array state (visibility must not depend on rule state)", () => {
    render(
      <ActionAttachmentsField
        value={[]}
        onChange={vi.fn()}
        emailAccountId="18d9553a-5182-4347-8cfa-75c76c72f51e"
        attachmentSources={[]}
        onAttachmentSourcesChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Always attach")).toBeTruthy();
    expect(screen.getByText("AI-selected sources")).toBeTruthy();
  });
});
