import type { calendar_v3 } from "@googleapis/calendar";
import { getCalendarClientWithRefresh } from "@/utils/calendar/client";
import type {
  CalendarEvent,
  CalendarEventProvider,
} from "@/utils/calendar/event-types";
import type { Logger } from "@/utils/logger";

export interface GoogleCalendarConnectionParams {
  accessToken: string | null;
  calendarIds?: string[];
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

  private getCalendarIds(): string[] {
    const ids = this.connection.calendarIds;
    return ids && ids.length > 0 ? ids : ["primary"];
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
    const calendarIds = this.getCalendarIds();

    const results = await Promise.allSettled(
      calendarIds.map((calendarId) =>
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
      if (result.status === "fulfilled") {
        return result.value.data.items ?? [];
      }
      this.logger.error("Error fetching Google events with attendee", {
        calendarId: calendarIds[index],
        error: result.reason,
      });
      return [];
    });

    return events
      .filter((event) =>
        event.attendees?.some(
          (a) => a.email?.toLowerCase() === attendeeEmail.toLowerCase(),
        ),
      )
      .map((event) => this.parseEvent(event))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, maxResults);
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
    const calendarIds = this.getCalendarIds();
    const effectiveMaxResults = maxResults || 10;

    const results = await Promise.allSettled(
      calendarIds.map((calendarId) =>
        client.events.list({
          calendarId,
          timeMin: timeMin?.toISOString(),
          timeMax: timeMax?.toISOString(),
          maxResults: effectiveMaxResults,
          singleEvents: true,
          orderBy: "startTime",
        }),
      ),
    );

    const events = results.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return result.value.data.items ?? [];
      }
      this.logger.error("Error fetching Google events", {
        calendarId: calendarIds[index],
        error: result.reason,
      });
      return [];
    });

    return events
      .map((event) => this.parseEvent(event))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, effectiveMaxResults);
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
