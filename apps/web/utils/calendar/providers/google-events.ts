import type { calendar_v3 } from "@googleapis/calendar";
import { getCalendarClientWithRefresh } from "@/utils/calendar/client";
import type {
  CalendarEvent,
  CalendarEventProvider,
} from "@/utils/calendar/event-types";
import type { Logger } from "@/utils/logger";

export interface GoogleCalendarConnectionParams {
  accessToken: string | null;
  calendarIds: string[];
  emailAccountId: string;
  expiresAt: number | null;
  refreshToken: string | null;
}

export class GoogleCalendarEventProvider implements CalendarEventProvider {
  private readonly connection: GoogleCalendarConnectionParams;
  private readonly logger: Logger;

  constructor(connection: GoogleCalendarConnectionParams, logger: Logger) {
    this.connection = connection;
    this.logger = logger;
  }

  private async getClient(): Promise<calendar_v3.Calendar> {
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
        client.events.list({
          calendarId,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          maxResults,
          singleEvents: true,
          orderBy: "startTime",
          q: attendeeEmail,
        }),
      ),
    );

    const events = results.flatMap((result, index) => {
      if (result.status === "rejected") {
        this.logger.warn("Failed to fetch events for calendar", {
          calendarId: this.connection.calendarIds[index],
          error: result.reason,
        });
        return [];
      }
      return result.value.data.items || [];
    });

    // Filter to events that actually have this attendee
    return events
      .filter((event) =>
        event.attendees?.some(
          (a) => a.email?.toLowerCase() === attendeeEmail.toLowerCase(),
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
    const perCalendarLimit = maxResults || 10;

    const results = await Promise.allSettled(
      this.connection.calendarIds.map((calendarId) =>
        client.events.list({
          calendarId,
          timeMin: timeMin?.toISOString(),
          timeMax: timeMax?.toISOString(),
          maxResults: perCalendarLimit,
          singleEvents: true,
          orderBy: "startTime",
        }),
      ),
    );

    const events = results.flatMap((result, index) => {
      if (result.status === "rejected") {
        this.logger.warn("Failed to fetch events for calendar", {
          calendarId: this.connection.calendarIds[index],
          error: result.reason,
        });
        return [];
      }
      return result.value.data.items || [];
    });

    return events
      .map((event) => this.parseEvent(event))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, perCalendarLimit);
  }

  private parseEvent(event: calendar_v3.Schema$Event) {
    const startTime = new Date(
      event.start?.dateTime || event.start?.date || Date.now(),
    );
    const endTime = new Date(
      event.end?.dateTime || event.end?.date || Date.now(),
    );

    let videoConferenceLink = event.hangoutLink ?? undefined;
    if (event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints.find(
        (entry) => entry.entryPointType === "video",
      );
      videoConferenceLink = videoEntry?.uri ?? videoConferenceLink;
    }

    return {
      id: event.id || "",
      title: event.summary || "Untitled",
      description: event.description || undefined,
      location: event.location || undefined,
      eventUrl: event.htmlLink || undefined,
      videoConferenceLink,
      startTime,
      endTime,
      attendees:
        event.attendees?.map((attendee) => ({
          email: attendee.email || "",
          name: attendee.displayName ?? undefined,
        })) || [],
    };
  }
}
