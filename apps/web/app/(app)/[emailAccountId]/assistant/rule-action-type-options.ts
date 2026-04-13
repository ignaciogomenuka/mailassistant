import { env } from "@/env";
import { ActionType, SystemType } from "@/generated/prisma/enums";
import { isMicrosoftProvider } from "@/utils/email/provider-types";

type ActionTypeOption = {
  label: string;
  value: ActionType;
};

export function getRuleActionTypeOptions({
  provider,
  labelActionText,
  hasConnectedMessagingChannels,
  hasAvailableMessagingProviders,
  systemType,
  existingActionTypes,
}: {
  provider: string;
  labelActionText: string;
  hasConnectedMessagingChannels: boolean;
  hasAvailableMessagingProviders: boolean;
  systemType: SystemType | null | undefined;
  existingActionTypes: ActionType[];
}): ActionTypeOption[] {
  const messagingIsAvailable =
    hasConnectedMessagingChannels || hasAvailableMessagingProviders;
  const includesExistingActionType = (actionType: ActionType) =>
    existingActionTypes.includes(actionType);

  const options: ActionTypeOption[] = [
    {
      label: labelActionText,
      value: ActionType.LABEL,
    },
    ...(isMicrosoftProvider(provider) ||
    includesExistingActionType(ActionType.MOVE_FOLDER)
      ? [
          {
            label: "Move to folder",
            value: ActionType.MOVE_FOLDER,
          },
        ]
      : []),
    ...(env.NEXT_PUBLIC_AUTO_DRAFT_DISABLED &&
    !includesExistingActionType(ActionType.DRAFT_EMAIL) &&
    !includesExistingActionType(ActionType.DRAFT_MESSAGING_CHANNEL)
      ? []
      : [
          {
            label: "Draft reply",
            value: ActionType.DRAFT_EMAIL,
          },
        ]),
    {
      label: "Archive",
      value: ActionType.ARCHIVE,
    },
    {
      label: "Mark read",
      value: ActionType.MARK_READ,
    },
    ...(env.NEXT_PUBLIC_EMAIL_SEND_ENABLED === false &&
    !includesExistingActionType(ActionType.REPLY) &&
    !includesExistingActionType(ActionType.SEND_EMAIL) &&
    !includesExistingActionType(ActionType.FORWARD)
      ? []
      : [
          {
            label: "Reply",
            value: ActionType.REPLY,
          },
          {
            label: "Send email",
            value: ActionType.SEND_EMAIL,
          },
          {
            label: "Forward",
            value: ActionType.FORWARD,
          },
        ]),
    {
      label: "Mark spam",
      value: ActionType.MARK_SPAM,
    },
    ...(env.NEXT_PUBLIC_WEBHOOK_ACTION_ENABLED === false &&
    !includesExistingActionType(ActionType.CALL_WEBHOOK)
      ? []
      : [
          {
            label: "Call webhook",
            value: ActionType.CALL_WEBHOOK,
          },
        ]),
    ...(messagingIsAvailable ||
    includesExistingActionType(ActionType.NOTIFY_MESSAGING_CHANNEL)
      ? [
          {
            label: "Notify via chat app",
            value: ActionType.NOTIFY_MESSAGING_CHANNEL,
          },
        ]
      : []),
    ...((systemType === SystemType.COLD_EMAIL &&
      env.NEXT_PUBLIC_IS_RESEND_CONFIGURED) ||
    includesExistingActionType(ActionType.NOTIFY_SENDER)
      ? [
          {
            label: "Notify sender",
            value: ActionType.NOTIFY_SENDER,
          },
        ]
      : []),
  ];

  return options;
}
