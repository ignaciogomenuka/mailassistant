import { describe, it, expect, beforeEach, vi } from "vitest";
import { GoogleCalendarEventProvider } from "./google-events";
import { getCalendarClientWithRefresh } from "@/utils/calendar/client";
import { createTestLogger } from "@/__tests__/helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/utils/calendar/client");

const logger = createTestLogger();

describe("GoogleCalendarEventProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchEvents", () => {
    it("calls events.list once per calendarId and merges results sorted by start", async () => {
      const eventsListMock = vi.fn();

      const primaryEvents = [
        {
          id: "p1",
          summary: "Primary early",
          start: { dateTime: "2026-04-14T09:00:00Z" },
          end: { dateTime: "2026-04-14T10:00:00Z" },
        },
        {
          id: "p2",
          summary: "Primary late",
          start: { dateTime: "2026-04-14T15:00:00Z" },
          end: { dateTime: "2026-04-14T16:00:00Z" },
        },
      ];

      const personalEvents = [
        {
          id: "pers1",
          summary: "Personal mid",
          start: { dateTime: "2026-04-14T12:00:00Z" },
          end: { dateTime: "2026-04-14T13:00:00Z" },
        },
      ];

      const sharedEvents = [
        {
          id: "sh1",
          summary: "Shared earliest",
          start: { dateTime: "2026-04-14T08:00:00Z" },
          end: { dateTime: "2026-04-14T08:30:00Z" },
        },
      ];

      eventsListMock.mockImplementation(({ calendarId }) => {
        if (calendarId === "primary")
          return Promise.resolve({ data: { items: primaryEvents } });
        if (calendarId === "personal@example")
          return Promise.resolve({ data: { items: personalEvents } });
        if (calendarId === "shared-id")
          return Promise.resolve({ data: { items: sharedEvents } });
        return Promise.resolve({ data: { items: [] } });
      });

      const fakeClient = {
        events: { list: eventsListMock },
      } as any;

      vi.mocked(getCalendarClientWithRefresh).mockResolvedValue(fakeClient);

      const provider = new GoogleCalendarEventProvider(
        {
          accessToken: "at",
          refreshToken: "rt",
          expiresAt: null,
          emailAccountId: "acct-1",
          calendarIds: ["primary", "personal@example", "shared-id"],
        },
        logger,
      );

      const timeMin = new Date("2026-04-14T00:00:00Z");
      const timeMax = new Date("2026-04-14T23:59:59Z");

      const events = await provider.fetchEvents({
        timeMin,
        timeMax,
        maxResults: 25,
      });

      expect(eventsListMock).toHaveBeenCalledTimes(3);

      const calledCalendarIds = eventsListMock.mock.calls
        .map((c) => c[0].calendarId)
        .sort();
      expect(calledCalendarIds).toEqual(
        ["personal@example", "primary", "shared-id"].sort(),
      );

      expect(events.map((e) => e.id)).toEqual(["sh1", "p1", "pers1", "p2"]);
    });

    it("respects maxResults across merged calendars", async () => {
      const eventsListMock = vi.fn().mockImplementation(({ calendarId }) => {
        if (calendarId === "primary") {
          return Promise.resolve({
            data: {
              items: [
                {
                  id: "a",
                  summary: "A",
                  start: { dateTime: "2026-04-14T09:00:00Z" },
                  end: { dateTime: "2026-04-14T10:00:00Z" },
                },
                {
                  id: "c",
                  summary: "C",
                  start: { dateTime: "2026-04-14T11:00:00Z" },
                  end: { dateTime: "2026-04-14T12:00:00Z" },
                },
              ],
            },
          });
        }
        return Promise.resolve({
          data: {
            items: [
              {
                id: "b",
                summary: "B",
                start: { dateTime: "2026-04-14T10:00:00Z" },
                end: { dateTime: "2026-04-14T10:30:00Z" },
              },
            ],
          },
        });
      });

      vi.mocked(getCalendarClientWithRefresh).mockResolvedValue({
        events: { list: eventsListMock },
      } as any);

      const provider = new GoogleCalendarEventProvider(
        {
          accessToken: "at",
          refreshToken: "rt",
          expiresAt: null,
          emailAccountId: "acct-1",
          calendarIds: ["primary", "other"],
        },
        logger,
      );

      const events = await provider.fetchEvents({
        timeMin: new Date("2026-04-14T00:00:00Z"),
        timeMax: new Date("2026-04-14T23:59:59Z"),
        maxResults: 2,
      });

      expect(events).toHaveLength(2);
      expect(events.map((e) => e.id)).toEqual(["a", "b"]);
    });

    it("tolerates a single calendar failure and returns events from the others", async () => {
      const eventsListMock = vi.fn().mockImplementation(({ calendarId }) => {
        if (calendarId === "broken") return Promise.reject(new Error("boom"));
        return Promise.resolve({
          data: {
            items: [
              {
                id: "ok-1",
                summary: "OK",
                start: { dateTime: "2026-04-14T09:00:00Z" },
                end: { dateTime: "2026-04-14T10:00:00Z" },
              },
            ],
          },
        });
      });

      vi.mocked(getCalendarClientWithRefresh).mockResolvedValue({
        events: { list: eventsListMock },
      } as any);

      const provider = new GoogleCalendarEventProvider(
        {
          accessToken: "at",
          refreshToken: "rt",
          expiresAt: null,
          emailAccountId: "acct-1",
          calendarIds: ["primary", "broken"],
        },
        logger,
      );

      const events = await provider.fetchEvents({
        timeMin: new Date("2026-04-14T00:00:00Z"),
        timeMax: new Date("2026-04-14T23:59:59Z"),
        maxResults: 25,
      });

      expect(events.map((e) => e.id)).toEqual(["ok-1"]);
    });
  });
});
