import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";

import { LiveEvents, type LiveEvent } from "./live-events";
import { db } from "@/lib/db";
import { liveEvents } from "@/lib/db/schema/events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Timeline | MHacks 2026",
  description: "The live MHacks schedule for events, workshops, and updates.",
};

const fallbackEvents: LiveEvent[] = [
  {
    id: "fallback-check-in",
    name: "Check-in Opens",
    startsAt: "2026-10-03T09:00:00-04:00",
    endsAt: "2026-10-03T11:00:00-04:00",
    location: "Michigan Union",
    description:
      "Pick up your badge, confirm your team details, and get settled before opening ceremony.",
    eventType: "Logistics",
    mapUrl: "https://maps.google.com/?q=Michigan+Union+Ann+Arbor",
  },
  {
    id: "fallback-opening",
    name: "Opening Ceremony",
    startsAt: "2026-10-03T11:30:00-04:00",
    endsAt: "2026-10-03T12:15:00-04:00",
    location: "Rackham Auditorium",
    description:
      "Meet the team, hear from sponsors, and get the final rules before hacking begins.",
    eventType: "Main Event",
    mapUrl: "https://maps.google.com/?q=Rackham+Auditorium+Ann+Arbor",
  },
  {
    id: "fallback-hacking",
    name: "Hacking Begins",
    startsAt: "2026-10-03T12:30:00-04:00",
    endsAt: null,
    location: "Hack Floor",
    description:
      "Find a table, sync with your team, and start building. Mentors will begin circulating shortly after.",
    eventType: "Main Event",
    mapUrl: null,
  },
  {
    id: "fallback-workshop",
    name: "Intro to Rapid Prototyping",
    startsAt: "2026-10-03T14:00:00-04:00",
    endsAt: "2026-10-03T14:45:00-04:00",
    location: "Workshop Room A",
    description:
      "A hands-on workshop for shaping a rough idea into a demoable product direction.",
    eventType: "Workshop",
    mapUrl: null,
  },
  {
    id: "fallback-dinner",
    name: "Dinner",
    startsAt: "2026-10-03T18:30:00-04:00",
    endsAt: "2026-10-03T20:00:00-04:00",
    location: "Dining Hall",
    description:
      "Dinner service for hackers, mentors, volunteers, and sponsors. Bring your badge.",
    eventType: "Food",
    mapUrl: null,
  },
  {
    id: "fallback-midnight",
    name: "Midnight Surprise",
    startsAt: "2026-10-04T00:00:00-04:00",
    endsAt: "2026-10-04T00:30:00-04:00",
    location: "Main Stage",
    description:
      "A quick reset with snacks, a mini-challenge, and a few reasons to leave your chair.",
    eventType: "Activity",
    mapUrl: null,
  },
  {
    id: "fallback-submissions",
    name: "Project Submissions Due",
    startsAt: "2026-10-04T12:30:00-04:00",
    endsAt: null,
    location: "Devpost",
    description:
      "Submit your project before the deadline. Make sure your demo link, team members, and prize tracks are correct.",
    eventType: "Deadline",
    mapUrl: null,
  },
  {
    id: "fallback-expo",
    name: "Expo and Judging",
    startsAt: "2026-10-04T13:30:00-04:00",
    endsAt: "2026-10-04T15:30:00-04:00",
    location: "Expo Floor",
    description:
      "Present your project to judges and other hackers. Teams should stay near their assigned table.",
    eventType: "Main Event",
    mapUrl: null,
  },
];

async function getLiveEvents() {
  if (!process.env.DATABASE_URL) {
    return { events: fallbackEvents, source: "fallback" as const };
  }

  try {
    const rows = await db
      .select()
      .from(liveEvents)
      .where(eq(liveEvents.isPublished, true))
      .orderBy(asc(liveEvents.startsAt));

    if (rows.length === 0) {
      return { events: fallbackEvents, source: "empty" as const };
    }

    return {
      events: rows.map((event) => ({
        id: event.id,
        name: event.name,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
        location: event.location,
        description: event.description,
        eventType: event.eventType,
        mapUrl: event.mapUrl,
      })),
      source: "database" as const,
    };
  } catch (error) {
    console.error("Failed to load live events", error);
    return { events: fallbackEvents, source: "fallback" as const };
  }
}

export default async function LivePage() {
  const { events, source } = await getLiveEvents();

  return <LiveEvents events={events} source={source} />;
}
