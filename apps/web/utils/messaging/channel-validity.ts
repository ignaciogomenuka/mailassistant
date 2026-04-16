import { MessagingProvider } from "@/generated/prisma/enums";

type MessagingChannelConnectionLike = {
  provider: MessagingProvider;
  isConnected?: boolean;
  accessToken?: string | null;
  providerUserId?: string | null;
};

export function hasRequiredMessagingConnectionFields(
  channel: MessagingChannelConnectionLike,
) {
  switch (channel.provider) {
    case MessagingProvider.SLACK:
      return Boolean(channel.accessToken && channel.providerUserId);
    case MessagingProvider.TEAMS:
      return Boolean(channel.providerUserId);
    case MessagingProvider.TELEGRAM:
      return true;
    default:
      return true;
  }
}

export function isMessagingChannelOperational(
  channel: MessagingChannelConnectionLike,
) {
  return (
    Boolean(channel.isConnected) &&
    hasRequiredMessagingConnectionFields(channel)
  );
}

export function getMessagingChannelReconnectMessage(
  provider: MessagingProvider,
) {
  if (provider === MessagingProvider.SLACK) {
    return "Please reconnect Slack before configuring notifications.";
  }

  if (provider === MessagingProvider.TEAMS) {
    return "Please reconnect Teams before configuring notifications.";
  }

  return "Please reconnect the messaging provider before configuring notifications.";
}
