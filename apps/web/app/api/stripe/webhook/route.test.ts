import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { getStripeTrialConvertedAt } from "./trial-conversion";

describe("getStripeTrialConvertedAt", () => {
  it("returns the event timestamp when a trial converts to active", () => {
    const event = subscriptionEvent({
      created: 1_700_000_000,
      data: {
        object: {
          status: "active",
          trial_end: 1_699_999_000,
        },
        previous_attributes: {
          status: "trialing",
        },
      },
    });

    expect(getStripeTrialConvertedAt(event)).toEqual(
      new Date("2023-11-14T22:13:20.000Z"),
    );
  });

  it("returns null when the subscription did not transition from trialing", () => {
    const event = subscriptionEvent({
      data: {
        object: {
          status: "active",
          trial_end: 1_699_999_000,
        },
        previous_attributes: {
          status: "incomplete",
        },
      },
    });

    expect(getStripeTrialConvertedAt(event)).toBeNull();
  });

  it("returns null when the trial has not ended yet", () => {
    const event = subscriptionEvent({
      created: 1_700_000_000,
      data: {
        object: {
          status: "active",
          trial_end: 1_700_000_100,
        },
        previous_attributes: {
          status: "trialing",
        },
      },
    });

    expect(getStripeTrialConvertedAt(event)).toBeNull();
  });
});

function subscriptionEvent(overrides: Partial<Stripe.Event>): Stripe.Event {
  return {
    id: "evt_test",
    type: "customer.subscription.updated",
    object: "event",
    api_version: "2025-03-31.basil",
    created: 1,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: "sub_test",
        status: "trialing",
        trial_end: null,
      },
      previous_attributes: {},
    },
    ...overrides,
  } as Stripe.Event;
}
