// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ChatTopBar } from "./chat-top-bar";

// Radix primitives use ResizeObserver which jsdom does not implement.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

vi.mock("server-only", () => ({}));

vi.mock("@/providers/ChatProvider", () => ({
  useChat: () => ({
    setNewChat: vi.fn(),
    setChatId: vi.fn(),
  }),
}));

vi.mock("@/hooks/useChats", () => ({
  useChats: () => ({
    data: { chats: [] },
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/components/LoadingContent", () => ({
  LoadingContent: ({ children }: { children: React.ReactNode }) => children,
}));

describe("ChatTopBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not render a close button when onClose is omitted", () => {
    render(<ChatTopBar hasMessages={false} />);
    expect(screen.queryByRole("button", { name: /close chat/i })).toBeNull();
  });

  it("renders a close button when onClose is provided", () => {
    const onClose = vi.fn();
    render(<ChatTopBar hasMessages={false} onClose={onClose} />);
    expect(screen.getByRole("button", { name: /close chat/i })).not.toBeNull();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<ChatTopBar hasMessages={true} onClose={onClose} />);
    const button = screen.getByRole("button", { name: /close chat/i });
    fireEvent.click(button);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
