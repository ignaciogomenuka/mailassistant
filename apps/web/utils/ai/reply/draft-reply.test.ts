import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEmail, getEmailAccount } from "@/__tests__/helpers";
import { aiDraftReplyWithConfidence } from "@/utils/ai/reply/draft-reply";
import { DraftReplyConfidence } from "@/generated/prisma/enums";

const { mockCreateGenerateObject, mockGenerateObject } = vi.hoisted(() => {
  const mockGenerateObject = vi.fn();
  const mockCreateGenerateObject = vi.fn(() => mockGenerateObject);
  return { mockCreateGenerateObject, mockGenerateObject };
});

vi.mock("server-only", () => ({}));

vi.mock("@/utils/llms/model", () => ({
  getModel: vi.fn(() => ({
    provider: "openai",
    modelName: "test-model",
    model: {},
    providerOptions: undefined,
    fallbackModels: [],
  })),
}));

vi.mock("@/utils/llms/index", () => ({
  createGenerateObject: mockCreateGenerateObject,
}));

describe("aiDraftReply confidence calibration (INB-176)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("system prompt includes confidence calibration covering subjective and personal abstain cases", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        reply: "Thanks.",
        confidence: DraftReplyConfidence.ALL_EMAILS,
      },
    });

    await aiDraftReplyWithConfidence(getDraftParams());

    const [callArgs] = mockGenerateObject.mock.calls.at(-1)!;
    const system: string = callArgs.system;

    // The system prompt must explicitly calibrate the confidence self-rating.
    expect(system.toLowerCase()).toContain("confidence");

    // It must tell the model to abstain (low confidence) on subjective /
    // personal content where drafting a reply risks making up answers.
    const lower = system.toLowerCase();
    const mentionsSubjective =
      lower.includes("subjective") ||
      lower.includes("personal opinion") ||
      lower.includes("personal question");
    expect(mentionsSubjective).toBe(true);

    // It must warn against committing on the user's behalf without grounding.
    const mentionsCommitments =
      lower.includes("commitment") ||
      lower.includes("commit on") ||
      lower.includes("speak for the user") ||
      lower.includes("on the user's behalf") ||
      lower.includes("on behalf of the user");
    expect(mentionsCommitments).toBe(true);

    // It must name the three confidence buckets so the model knows how to grade itself.
    expect(system).toContain("HIGH_CONFIDENCE");
    expect(system).toContain("STANDARD");
    expect(system).toContain("ALL_EMAILS");
  });

  it("confidence Zod describe enumerates concrete abstain criteria, not just a level list", async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        reply: "Thanks.",
        confidence: DraftReplyConfidence.STANDARD,
      },
    });

    await aiDraftReplyWithConfidence(getDraftParams());

    const [callArgs] = mockGenerateObject.mock.calls.at(-1)!;
    const schema = callArgs.schema;
    const confidenceShape = schema.shape.confidence;
    const describe: string = confidenceShape.description ?? "";
    const lower = describe.toLowerCase();

    // Must still name the buckets.
    expect(describe).toContain("HIGH_CONFIDENCE");
    expect(describe).toContain("STANDARD");
    expect(describe).toContain("ALL_EMAILS");

    // Must enumerate abstain cases so a model cannot self-rate HIGH on
    // subjective / personal content.
    const mentionsSubjective =
      lower.includes("subjective") || lower.includes("personal");
    expect(mentionsSubjective).toBe(true);

    const mentionsCommitments =
      lower.includes("commit") || lower.includes("behalf");
    expect(mentionsCommitments).toBe(true);

    // The describe should go beyond the previous terse one-sentence blurb.
    expect(describe.length).toBeGreaterThan(250);
  });
});

function getDraftParams() {
  const message = getEmail({
    from: "sender@example.com",
    subject: "Question",
    to: "user@example.com",
    date: new Date("2026-02-06T12:00:00.000Z"),
    content: "Can you help with this?",
  });

  const baseEmailAccount = getEmailAccount({
    email: "user@example.com",
  });
  const emailAccount = {
    ...baseEmailAccount,
    id: "account-1",
    user: {
      ...baseEmailAccount.user,
      aiProvider: "openai",
      aiModel: "gpt-5.1",
      aiApiKey: null,
    },
  };

  return {
    messages: [{ ...message, id: "msg-1" }],
    emailAccount,
    knowledgeBaseContent: null,
    emailHistorySummary: null,
    emailHistoryContext: null,
    calendarAvailability: null,
    writingStyle: null,
    mcpContext: null,
    meetingContext: null,
  } as Parameters<typeof aiDraftReplyWithConfidence>[0];
}
