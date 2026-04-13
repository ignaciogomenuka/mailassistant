import { env } from "@/env";
import { ActionType, SystemType } from "@/generated/prisma/enums";
import {
  getAvailableActionsForRuleEditor,
  getExtraAvailableActionsForRuleEditor,
} from "@/utils/ai/rule/action-availability";

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
  const availableActions = new Set(
    getAvailableActionsForRuleEditor({
      provider,
      existingActionTypes,
    }),
  );
  const extraActions = new Set(
    getExtraAvailableActionsForRuleEditor(existingActionTypes),
  );

  const options: ActionTypeOption[] = [
    {
      label: labelActionText,
      value: ActionType.LABEL,
    },
    ...(availableActions.has(ActionType.MOVE_FOLDER)
      ? [
          {
            label: "Move to folder",
            value: ActionType.MOVE_FOLDER,
          },
        ]
      : []),
    ...(availableActions.has(ActionType.DRAFT_EMAIL)
      ? [
          {
            label: "Draft reply",
            value: ActionType.DRAFT_EMAIL,
          },
        ]
      : []),
    {
      label: "Archive",
      value: ActionType.ARCHIVE,
    },
    {
      label: "Mark read",
      value: ActionType.MARK_READ,
    },
    ...(availableActions.has(ActionType.REPLY)
      ? [
          {
            label: "Reply",
            value: ActionType.REPLY,
          },
        ]
      : []),
    ...(availableActions.has(ActionType.SEND_EMAIL)
      ? [
          {
            label: "Send email",
            value: ActionType.SEND_EMAIL,
          },
        ]
      : []),
    ...(availableActions.has(ActionType.FORWARD)
      ? [
          {
            label: "Forward",
            value: ActionType.FORWARD,
          },
        ]
      : []),
    {
      label: "Mark spam",
      value: ActionType.MARK_SPAM,
    },
    ...(extraActions.has(ActionType.CALL_WEBHOOK)
      ? [
          {
            label: "Call webhook",
            value: ActionType.CALL_WEBHOOK,
          },
        ]
      : []),
    ...(messagingIsAvailable ||
    existingActionTypes.includes(ActionType.NOTIFY_MESSAGING_CHANNEL)
      ? [
          {
            label: "Notify via chat app",
            value: ActionType.NOTIFY_MESSAGING_CHANNEL,
          },
        ]
      : []),
    ...((systemType === SystemType.COLD_EMAIL &&
      env.NEXT_PUBLIC_IS_RESEND_CONFIGURED) ||
    existingActionTypes.includes(ActionType.NOTIFY_SENDER)
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
