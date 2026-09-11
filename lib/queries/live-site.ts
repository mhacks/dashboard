import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/events";
import {
  liveAnnouncements,
  liveEventDetails,
  liveEventResources,
  liveGuideLinks,
  livePrizes,
  liveSiteSettings,
} from "@/lib/db/schema/live";
import type {
  EventResource,
  GuideLink,
  LiveAnnouncement,
  LiveEvent,
  LiveSiteContent,
  LiveSiteSettings,
  Prize,
} from "@/lib/live/types";

export const DEFAULT_LIVE_SITE_SETTINGS: LiveSiteSettings = {
  eventName: "MHacks Live",
  heroTitle: "Timeline",
  heroDescription: "Events, workshops, food, and deadlines for the weekend.",
  timezone: "America/Detroit",
  devpostUrl: null,
  guideEmptyTitle: "Hacker guide coming soon",
  guideEmptyDescription:
    "Travel details, venue information, policies, and weekend resources are being assembled here.",
  prizesEmptyTitle: "Prize details coming soon",
  prizesEmptyDescription:
    "Track descriptions, eligibility details, and judging criteria will appear here once they are finalized.",
};

function mapSettings(
  row: typeof liveSiteSettings.$inferSelect | undefined,
): LiveSiteSettings {
  if (!row) return DEFAULT_LIVE_SITE_SETTINGS;

  return {
    eventName: row.eventName,
    heroTitle: row.heroTitle,
    heroDescription: row.heroDescription,
    timezone: row.timezone,
    devpostUrl: row.devpostUrl,
    guideEmptyTitle: row.guideEmptyTitle,
    guideEmptyDescription: row.guideEmptyDescription,
    prizesEmptyTitle: row.prizesEmptyTitle,
    prizesEmptyDescription: row.prizesEmptyDescription,
  };
}

function mapResources(
  rows: (typeof liveEventResources.$inferSelect)[],
): Map<string, EventResource[]> {
  const byEvent = new Map<string, EventResource[]>();

  for (const row of rows) {
    const resource: EventResource = {
      id: row.id,
      kind: row.kind,
      label: row.label,
      href: row.url,
      position: row.position,
    };
    byEvent.set(row.eventId, [...(byEvent.get(row.eventId) ?? []), resource]);
  }

  return byEvent;
}

function mapEvent(
  row: {
    event: typeof events.$inferSelect;
    details: typeof liveEventDetails.$inferSelect | null;
  },
  resources: Map<string, EventResource[]>,
): LiveEvent {
  const { event, details } = row;

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    summary: event.description ?? "",
    description: details?.description ?? "",
    startsAt: event.startsAt ?? "",
    endsAt: event.endsAt,
    location: event.location ?? "",
    locationDetails: details?.locationDetails ?? "",
    mapUrl: details?.mapUrl ?? null,
    eventType: details?.eventType ?? "Event",
    hostName: details?.hostName ?? null,
    audience: details?.audience ?? null,
    capacity: details?.capacity ?? null,
    featured: details?.featured ?? false,
    status: details?.status ?? "draft",
    position: details?.position ?? 0,
    resources: resources.get(event.id) ?? [],
  };
}

function mapAnnouncement(
  row: typeof liveAnnouncements.$inferSelect,
): LiveAnnouncement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tone: row.tone,
    status: row.status,
    postedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    position: row.position,
  };
}

function mapGuideLink(row: typeof liveGuideLinks.$inferSelect): GuideLink {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    href: row.url,
    category: row.category,
    status: row.status,
    position: row.position,
  };
}

function mapPrize(row: typeof livePrizes.$inferSelect): Prize {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sponsor: row.sponsor,
    value: row.value,
    eligibility: row.eligibility,
    judgingCriteria: row.judgingCriteria,
    href: row.url,
    status: row.status,
    position: row.position,
  };
}

async function loadLiveSiteContent(includeUnpublished: boolean) {
  const now = new Date().toISOString();
  const announcementFilter = includeUnpublished
    ? undefined
    : and(
        eq(liveAnnouncements.status, "published"),
        or(
          isNull(liveAnnouncements.publishedAt),
          lte(liveAnnouncements.publishedAt, now),
        ),
        or(
          isNull(liveAnnouncements.expiresAt),
          gt(liveAnnouncements.expiresAt, now),
        ),
      );

  const [settingsRows, eventRows, announcementRows, guideRows, prizeRows] =
    await Promise.all([
      db
        .select()
        .from(liveSiteSettings)
        .where(eq(liveSiteSettings.id, "default"))
        .limit(1),
      db
        .select({ event: events, details: liveEventDetails })
        .from(events)
        .leftJoin(liveEventDetails, eq(liveEventDetails.eventId, events.id))
        .where(
          includeUnpublished
            ? undefined
            : and(
                eq(liveEventDetails.status, "published"),
                isNotNull(events.startsAt),
              ),
        )
        .orderBy(asc(events.startsAt), asc(liveEventDetails.position)),
      db
        .select()
        .from(liveAnnouncements)
        .where(announcementFilter)
        .orderBy(
          asc(liveAnnouncements.position),
          desc(liveAnnouncements.publishedAt),
        ),
      db
        .select()
        .from(liveGuideLinks)
        .where(
          includeUnpublished
            ? undefined
            : eq(liveGuideLinks.status, "published"),
        )
        .orderBy(asc(liveGuideLinks.position), asc(liveGuideLinks.title)),
      db
        .select()
        .from(livePrizes)
        .where(
          includeUnpublished ? undefined : eq(livePrizes.status, "published"),
        )
        .orderBy(asc(livePrizes.position), asc(livePrizes.title)),
    ]);

  const resourceRows =
    eventRows.length === 0
      ? []
      : await db
          .select()
          .from(liveEventResources)
          .where(
            inArray(
              liveEventResources.eventId,
              eventRows.map(({ event }) => event.id),
            ),
          )
          .orderBy(
            asc(liveEventResources.eventId),
            asc(liveEventResources.position),
          );
  const resources = mapResources(resourceRows);

  return {
    settings: mapSettings(settingsRows[0]),
    events: eventRows.map((row) => mapEvent(row, resources)),
    announcements: announcementRows.map(mapAnnouncement),
    guideLinks: guideRows.map(mapGuideLink),
    prizes: prizeRows.map(mapPrize),
  } satisfies LiveSiteContent;
}

export function getPublicLiveSiteContent() {
  return loadLiveSiteContent(false);
}

export async function getOrganizerLiveSiteContent() {
  await requireOrganizer();
  return loadLiveSiteContent(true);
}
