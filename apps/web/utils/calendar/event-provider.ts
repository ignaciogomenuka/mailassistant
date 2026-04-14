import prisma from "@/utils/prisma";
import type { Logger } from "@/utils/logger";
import type { CalendarEventProvider } from "@/utils/calendar/event-types";
import { GoogleCalendarEventProvider } from "@/utils/calendar/providers/google-events";
import { MicrosoftCalendarEventProvider } from "@/utils/calendar/providers/microsoft-events";
import { isGoogleProvider } from "@/utils/email/provider-types";

/**
 * Create calendar event providers for all connected calendars.
 * Fetches calendar connections once and creates providers that can be reused.
 */
export async function createCalendarEventProviders(
  emailAccountId: string,
  logger: Logger,
): Promise<CalendarEventProvider[]> {
  const connections = await prisma.calendarConnection.findMany({
    where: {
      emailAccountId,
      isConnected: true,
    },
    select: {
      id: true,
      provider: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      calendars: {
        where: { isEnabled: true },
        select: {
          calendarId: true,
          primary: true,
        },
      },
    },
  });

  if (connections.length === 0) {
    logger.info("No calendar connections found", { emailAccountId });
    return [];
  }

  const providers: CalendarEventProvider[] = [];

  for (const connection of connections) {
    if (!connection.refreshToken) continue;

    const calendarIds = connection.calendars.map((cal) => cal.calendarId);
    if (calendarIds.length === 0) {
      logger.info("No enabled calendars for connection", {
        connectionId: connection.id,
        provider: connection.provider,
      });
      continue;
    }

    try {
      if (isGoogleProvider(connection.provider)) {
        providers.push(
          new GoogleCalendarEventProvider(
            {
              accessToken: connection.accessToken,
              refreshToken: connection.refreshToken,
              expiresAt: connection.expiresAt?.getTime() ?? null,
              emailAccountId,
              calendarIds,
            },
            logger,
          ),
        );
      } else if (connection.provider === "microsoft") {
        providers.push(
          new MicrosoftCalendarEventProvider(
            {
              accessToken: connection.accessToken,
              refreshToken: connection.refreshToken,
              expiresAt: connection.expiresAt?.getTime() ?? null,
              emailAccountId,
              calendarIds,
            },
            logger,
          ),
        );
      }
    } catch (error) {
      logger.error("Failed to create calendar event provider", {
        provider: connection.provider,
        error,
      });
    }
  }

  return providers;
}
