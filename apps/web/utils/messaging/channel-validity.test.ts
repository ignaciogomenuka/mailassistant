import { describe, expect, it } from "vitest";
import { MessagingProvider } from "@/generated/prisma/enums";
import {
  getMessagingChannelReconnectMessage,
  hasRequiredMessagingConnectionFields,
  isMessagingChannelOperational,
} from "@/utils/messaging/channel-validity";

describe("messaging channel validity", () => {
  it("requires both a token and provider user id for Slack", () => {
    expect(
      hasRequiredMessagingConnectionFields({
        provider: MessagingProvider.SLACK,
        accessToken: "xoxb-token",
        providerUserId: "U123",
      }),
    ).toBe(true);

    expect(
      hasRequiredMessagingConnectionFields({
        provider: MessagingProvider.SLACK,
        accessToken: "xoxb-token",
        providerUserId: null,
      }),
    ).toBe(false);
  });

  it("requires a provider user id for Teams", () => {
    expect(
      hasRequiredMessagingConnectionFields({
        provider: MessagingProvider.TEAMS,
        accessToken: null,
        providerUserId: "29:teams-user",
      }),
    ).toBe(true);

    expect(
      hasRequiredMessagingConnectionFields({
        provider: MessagingProvider.TEAMS,
        accessToken: null,
        providerUserId: null,
      }),
    ).toBe(false);
  });

  it("treats Telegram as operational when connected", () => {
    expect(
      isMessagingChannelOperational({
        provider: MessagingProvider.TELEGRAM,
        isConnected: true,
        accessToken: null,
        providerUserId: null,
      }),
    ).toBe(true);

    expect(
      isMessagingChannelOperational({
        provider: MessagingProvider.TELEGRAM,
        isConnected: false,
        accessToken: null,
        providerUserId: null,
      }),
    ).toBe(false);
  });

  it("returns provider-specific reconnect messages", () => {
    expect(getMessagingChannelReconnectMessage(MessagingProvider.SLACK)).toBe(
      "Please reconnect Slack before configuring notifications.",
    );
    expect(getMessagingChannelReconnectMessage(MessagingProvider.TEAMS)).toBe(
      "Please reconnect Teams before configuring notifications.",
    );
  });
});
