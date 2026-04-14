import type { Client } from "@microsoft/microsoft-graph-client";
import { getCalendarClientWithRefresh } from "@/utils/outlook/calendar-client";
import type {
  CalendarEvent,
  CalendarEventProvider,
} from "@/utils/calendar/event-types";
import type { Logger } from "@/utils/logger";

export interface MicrosoftCalendarConnectionParams {
  accessToken: string | null;
  calendarIds: string[];
  emailAccountId: string;
  expiresAt: number | null;
  refreshToken: string | null;
}

type MicrosoftEvent = {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: Array<{
    emailAddress?: { address?: string; name?: string };
  }>;
  location?: { displayName?: string };
  webLink?: string;
  onlineMeeting?: { joinUrl?: string };
  onlineMeetingUrl?: string;
};

export class MicrosoftCalendarEventProvider implements CalendarEventProvider {
  private readonly connection: MicrosoftCalendarConnectionParams;
  private readonly logger: Logger;

  constructor(connection: MicrosoftCalendarConnectionParams, logger: Logger) {
    this.connection = connection;
    this.logger = logger;
  }

  private async getClient(): Promise<Client> {
    return getCalendarClientWithRefresh({
      accessToken: this.connection.accessToken,
      refreshToken: this.connection.refreshToken,
      expiresAt: this.connection.expiresAt,
      emailAccountId: this.connection.emailAccountId,
      logger: this.logger,
    });
  }

  async fetchEventsWithAttendee({
    attendeeEmail,
    timeMin,
    timeMax,
    maxResults,
  }: {
    attendeeEmail: string;
    timeMin: Date;
    timeMax: Date;
    maxResults: number;
  }): Promise<CalendarEvent[]> {
    const client = await this.getClient();

    const results = await Promise.allSettled(
      this.connection.calendarIds.map((calendarId) =>
        client
          .api(`/me/calendars/${calendarId}/calendarView`)
          .query({
            startDateTime: timeMin.toISOString(),
            endDateTime: timeMax.toISOString(),
          })
          .top(maxResults * 3) // Fetch more to filter by attendee
          .orderby("start/dateTime")
          .get(),
      ),
    );

    const events: MicrosoftEvent[] = results.flatMap((result, index) => {
      if (result.status === "rejected") {
        this.logger.warn("Failed to fetch events for calendar", {
          calendarId: this.connection.calendarIds[index],
          error: result.reason,
        });
        return [];
      }
      return result.value.value || [];
    });

    // Filter to events that have this attendee
    return events
      .filter((event) =>
        event.attendees?.some(
          (a) =>
            a.emailAddress?.address?.toLowerCase() ===
            attendeeEmail.toLowerCase(),
        ),
      )
      .slice(0, maxResults)
      .map((event) => this.parseEvent(event));
  }

  async fetchEvents({
    timeMin = new Date(),
    timeMax,
    maxResults,
  }: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
  }): Promise<CalendarEvent[]> {
    const client = await this.getClient();

    // calendarView requires both start and end times, default to 30 days from timeMin
    const effectiveTimeMax =
      timeMax ?? new Date(timeMin.getTime() + 30 * 24 * 60 * 60 * 1000);
    const perCalendarLimit = maxResults || 100;

    const results = await Promise.allSettled(
      this.connection.calendarIds.map((calendarId) =>
        client
          .api(`/me/calendars/${calendarId}/calendarView`)
          .query({
            startDateTime: timeMin.toISOString(),
            endDateTime: effectiveTimeMax.toISOString(),
          })
          .top(perCalendarLimit)
          .orderby("start/dateTime")
          .get(),
      ),
    );

    const events: MicrosoftEvent[] = results.flatMap((result, index) => {
      if (result.status === "rejected") {
        this.logger.warn("Failed to fetch events for calendar", {
          calendarId: this.connection.calendarIds[index],
          error: result.reason,
        });
        return [];
      }
      return result.value.value || [];
    });

    return events
      .map((event) => this.parseEvent(event))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, perCalendarLimit);
  }

  private parseEvent(event: MicrosoftEvent) {
    return {
      id: event.id || "",
      title: event.subject || "Untitled",
      description: event.bodyPreview || undefined,
      location: event.location?.displayName || undefined,
      eventUrl: event.webLink || undefined,
      videoConferenceLink:
        event.onlineMeeting?.joinUrl || event.onlineMeetingUrl || undefined,
      startTime: new Date(event.start?.dateTime || Date.now()),
      endTime: new Date(event.end?.dateTime || Date.now()),
      attendees:
        event.attendees?.map((attendee) => ({
          email: attendee.emailAddress?.address || "",
          name: attendee.emailAddress?.name ?? undefined,
        })) || [],
    };
  }
}
