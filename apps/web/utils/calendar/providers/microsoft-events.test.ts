import { describe, it, expect, beforeEach, vi } from "vitest";
import { MicrosoftCalendarEventProvider } from "./microsoft-events";
import { getCalendarClientWithRefresh } from "@/utils/outlook/calendar-client";
import { createTestLogger } from "@/__tests__/helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/utils/outlook/calendar-client");

const logger = createTestLogger();

describe("MicrosoftCalendarEventProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchEvents", () => {
    it("queries calendarView scoped to each calendarId and merges results sorted by start", async () => {
      const apiMock = vi.fn();
      const fakeClient = { api: apiMock };

      const calendarResponses: Record<string, any> = {
        "/me/calendars/primary/calendarView": {
          value: [
            {
              id: "p1",
              subject: "Primary mid",
              start: { dateTime: "2026-04-14T12:00:00Z" },
              end: { dateTime: "2026-04-14T13:00:00Z" },
            },
          ],
        },
        "/me/calendars/personal-id/calendarView": {
          value: [
            {
              id: "pers1",
              subject: "Personal early",
              start: { dateTime: "2026-04-14T08:00:00Z" },
              end: { dateTime: "2026-04-14T09:00:00Z" },
            },
          ],
        },
        "/me/calendars/shared-id/calendarView": {
          value: [
            {
              id: "sh1",
              subject: "Shared late",
              start: { dateTime: "2026-04-14T18:00:00Z" },
              end: { dateTime: "2026-04-14T19:00:00Z" },
            },
          ],
        },
      };

      apiMock.mockImplementation((path: string) => {
        const response = calendarResponses[path] ?? { value: [] };
        const builder: any = {
          query: () => builder,
          top: () => builder,
          orderby: () => builder,
          select: () => builder,
          header: () => builder,
          get: () => Promise.resolve(response),
        };
        return builder;
      });

      vi.mocked(getCalendarClientWithRefresh).mockResolvedValue(
        fakeClient as any,
      );

      const provider = new MicrosoftCalendarEventProvider(
        {
          accessToken: "at",
          refreshToken: "rt",
          expiresAt: null,
          emailAccountId: "acct-1",
          calendarIds: ["primary", "personal-id", "shared-id"],
        },
        logger,
      );

      const events = await provider.fetchEvents({
        timeMin: new Date("2026-04-14T00:00:00Z"),
        timeMax: new Date("2026-04-14T23:59:59Z"),
        maxResults: 25,
      });

      const calendarApiCalls = apiMock.mock.calls
        .map((c) => c[0] as string)
        .filter((p) => p.includes("/calendarView"));
      expect(calendarApiCalls.sort()).toEqual(
        [
          "/me/calendars/primary/calendarView",
          "/me/calendars/personal-id/calendarView",
          "/me/calendars/shared-id/calendarView",
        ].sort(),
      );

      expect(events.map((e) => e.id)).toEqual(["pers1", "p1", "sh1"]);
    });
  });
});
