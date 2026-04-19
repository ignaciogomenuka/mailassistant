"use client";

import {
  Megaphone,
  Users,
  Play,
  MessageCircle,
  Briefcase,
  Search,
  Mic,
  Newspaper,
  MoreHorizontal,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useCallback } from "react";
import { PageHeading, TypographyP } from "@/components/Typography";
import { IconCircle } from "@/app/(app)/[emailAccountId]/onboarding/IconCircle";
import { OnboardingWrapper } from "@/app/(app)/[emailAccountId]/onboarding/OnboardingWrapper";
import { OnboardingButton } from "@/app/(app)/[emailAccountId]/onboarding/OnboardingButton";
import { saveOnboardingAnswersAction } from "@/utils/actions/onboarding";
import { toastError } from "@/components/Toast";
import { captureException, getActionErrorMessage } from "@/utils/error";

const SOURCES = [
  {
    value: "friend",
    label: "Friend or colleague",
    icon: <Users className="size-4" />,
  },
  {
    value: "youtube",
    label: "YouTube",
    icon: <Play className="size-4" />,
  },
  {
    value: "twitter",
    label: "Twitter / X",
    icon: <MessageCircle className="size-4" />,
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    icon: <Briefcase className="size-4" />,
  },
  {
    value: "search",
    label: "Google search",
    icon: <Search className="size-4" />,
  },
  {
    value: "podcast",
    label: "Podcast",
    icon: <Mic className="size-4" />,
  },
  {
    value: "blog",
    label: "Blog or article",
    icon: <Newspaper className="size-4" />,
  },
  {
    value: "other",
    label: "Other",
    icon: <MoreHorizontal className="size-4" />,
  },
];

export function StepHowYouHeard({ onNext }: { onNext: () => void }) {
  const { executeAsync: saveSource } = useAction(saveOnboardingAnswersAction);

  const onSelectSource = useCallback(
    (source: string) => {
      onNext();

      saveSource({
        surveyId: "onboarding",
        questions: [{ key: "source", type: "single_choice" }],
        answers: { $survey_response: source },
      })
        .then((result) => {
          if (result?.serverError || result?.validationErrors) {
            captureException(new Error("Failed to save onboarding source"), {
              extra: {
                context: "onboarding",
                step: "source",
                serverError: result?.serverError,
                validationErrors: result?.validationErrors,
              },
            });
            toastError({
              description: getActionErrorMessage(
                {
                  serverError: result?.serverError,
                  validationErrors: result?.validationErrors,
                },
                {
                  prefix:
                    "We couldn't save that answer, but you can keep going",
                },
              ),
            });
          }
        })
        .catch((error) => {
          captureException(error, {
            extra: {
              context: "onboarding",
              step: "source",
            },
          });
          toastError({
            description:
              "We couldn't save that answer, but you can keep going.",
          });
        });
    },
    [onNext, saveSource],
  );

  return (
    <OnboardingWrapper className="py-0">
      <IconCircle size="lg" className="mx-auto">
        <Megaphone className="size-6" />
      </IconCircle>

      <div className="text-center mt-4">
        <PageHeading>How did you hear about Inbox Zero?</PageHeading>
        <TypographyP className="mt-2 max-w-lg mx-auto">
          We'd love to know how you found us.
        </TypographyP>
      </div>

      <div className="mt-6 grid gap-3">
        {SOURCES.map((source) => (
          <OnboardingButton
            key={source.value}
            text={source.label}
            icon={source.icon}
            onClick={() => onSelectSource(source.value)}
          />
        ))}
      </div>
    </OnboardingWrapper>
  );
}
