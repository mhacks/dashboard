"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { eventCheckins, events, eventScanLog } from "@/lib/db/schema/events";
import {
  eventSlugSchema,
  MAX_EVENT_NAME_LENGTH,
  slugifyEventName,
} from "@/lib/types/events";

export type EventActionResult =
  { ok: true; slug: string } | { ok: false; message: string };

/**
 * Optional free text: an empty string from a form field means "not set", not
 * an empty value, so it is stored as NULL.
 */
const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable();

/**
 * Everything on the schedule happens in Ann Arbor, so a bare wall-clock time is
 * Eastern — whatever the clock on the machine running this says. Deployed, that
 * machine is on UTC, and reading 6pm as UTC would put dinner on the board at
 * 2pm.
 */
const EVENT_TIME_ZONE = "America/Detroit";

const ZONE_READING = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Anything already carrying "Z" or "+04:00" states its own instant. */
const HAS_OFFSET = /([Zz]|[+-]\d{2}:?\d{2})$/;

/** How far EVENT_TIME_ZONE sits from UTC at a given instant, in ms. */
function zoneOffsetMs(instant: number) {
  const read = Object.fromEntries(
    ZONE_READING.formatToParts(instant).map((part) => [part.type, part.value]),
  );

  return (
    Date.UTC(
      Number(read.year),
      Number(read.month) - 1,
      Number(read.day),
      Number(read.hour),
      Number(read.minute),
      Number(read.second),
    ) - instant
  );
}

/**
 * Resolves what an organizer typed against EVENT_TIME_ZONE. Returns null for
 * anything unparseable, which is what the schema below reports back to them.
 *
 * The offset is looked up twice on purpose. The first lookup has to ask "what is
 * the offset at this instant?" while still holding a wall clock rather than an
 * instant, so near a DST switch it answers for the wrong side of it: 3am on
 * 8 March 2026 comes back as 08:00Z, an hour late. Asking again from the
 * corrected instant lands on 07:00Z and stays there.
 */
function fromEventZone(value: string) {
  if (HAS_OFFSET.test(value)) {
    const stated = Date.parse(value);
    return Number.isNaN(stated) ? null : new Date(stated).toISOString();
  }

  // Read the wall clock as though it were UTC, then slide it into place.
  const wall = Date.parse(`${value}Z`);
  if (Number.isNaN(wall)) return null;

  const guess = wall - zoneOffsetMs(wall);
  return new Date(wall - zoneOffsetMs(guess)).toISOString();
}

/**
 * datetime-local inputs submit "2026-10-10T18:00" with no zone at all. Stored
 * as the instant that reading names in Ann Arbor, so the row means the same
 * thing wherever it is later read.
 */
const optionalTimestamp = z
  .string()
  .trim()
  .nullable()
  .refine(
    (value) => value === null || value.length === 0 || fromEventZone(value),
    "Enter a valid date and time.",
  )
  .transform((value) =>
    value === null || value.length === 0 ? null : fromEventZone(value),
  );

const eventFieldsSchema = z.object({
  name: z.string().trim().min(1).max(MAX_EVENT_NAME_LENGTH),
  description: optionalText,
  location: optionalText,
  startsAt: optionalTimestamp,
  endsAt: optionalTimestamp,
});

const createEventSchema = eventFieldsSchema.extend({
  // Blank means "derive it from the name".
  slug: z.union([eventSlugSchema, z.literal("")]),
});

const updateEventSchema = eventFieldsSchema.extend({
  slug: eventSlugSchema,
  currentSlug: eventSlugSchema,
});

function endsBeforeStart(startsAt: string | null, endsAt: string | null) {
  if (!startsAt || !endsAt) return false;
  return Date.parse(endsAt) < Date.parse(startsAt);
}

/**
 * Appends `-2`, `-3`, … until the slug is free. Bounded rather than looping
 * forever — twenty events sharing one name is a naming problem, not something
 * to keep silently working around.
 */
async function uniqueSlug(
  base: string,
  excludeId?: string,
): Promise<string | null> {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const clash = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, candidate))
      .limit(1);

    if (!clash[0] || clash[0].id === excludeId) return candidate;
  }
  return null;
}

export async function createEventAction(
  input: unknown,
): Promise<EventActionResult> {
  const organizer = await requireOrganizer();

  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the event details.",
    };
  }

  const { slug, name, description, location, startsAt, endsAt } = parsed.data;

  if (endsBeforeStart(startsAt, endsAt)) {
    return { ok: false, message: "The end time is before the start time." };
  }

  const base = slug || slugifyEventName(name);
  if (!base) {
    return {
      ok: false,
      message: "Add a URL slug — the name didn't produce one.",
    };
  }

  const resolved = await uniqueSlug(base);
  if (!resolved) {
    return {
      ok: false,
      message: "Too many events share that name. Pick a different slug.",
    };
  }

  await db.insert(events).values({
    slug: resolved,
    name,
    description,
    location,
    startsAt,
    endsAt,
    createdBy: organizer.id,
  });

  revalidatePath("/admin/events");
  revalidatePath("/checkin");
  return { ok: true, slug: resolved };
}

export async function updateEventAction(
  input: unknown,
): Promise<EventActionResult> {
  await requireOrganizer();

  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the event details.",
    };
  }

  const { currentSlug, slug, name, description, location, startsAt, endsAt } =
    parsed.data;

  if (endsBeforeStart(startsAt, endsAt)) {
    return { ok: false, message: "The end time is before the start time." };
  }

  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, currentSlug))
    .limit(1);

  const event = existing[0];
  if (!event) return { ok: false, message: "That event no longer exists." };

  const resolved = await uniqueSlug(slug, event.id);
  if (!resolved) {
    return { ok: false, message: "That slug is taken. Pick a different one." };
  }

  await db
    .update(events)
    .set({ slug: resolved, name, description, location, startsAt, endsAt })
    .where(eq(events.id, event.id));

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${resolved}`);
  revalidatePath("/checkin");
  return { ok: true, slug: resolved };
}

const setActiveSchema = z.strictObject({
  slug: eventSlugSchema,
  isActive: z.boolean(),
});

/** Opens or closes an event's scanner. The only switch volunteers feel. */
export async function setEventActiveAction(
  input: unknown,
): Promise<EventActionResult> {
  await requireOrganizer();

  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const updated = await db
    .update(events)
    .set({ isActive: parsed.data.isActive })
    .where(eq(events.slug, parsed.data.slug))
    .returning({ slug: events.slug });

  if (!updated[0])
    return { ok: false, message: "That event no longer exists." };

  revalidatePath("/admin/events");
  revalidatePath("/checkin");
  return { ok: true, slug: updated[0].slug };
}

const deleteEventSchema = z.strictObject({
  slug: eventSlugSchema,
  confirmationName: z.string().trim().min(1),
});

/**
 * Deleting an event takes its check-ins and its scan log with it, so the name
 * has to be typed to confirm — the same bar as deleting an RSVP.
 */
export async function deleteEventAction(
  input: unknown,
): Promise<EventActionResult> {
  await requireOrganizer();

  const parsed = deleteEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter the event name to confirm." };
  }

  const rows = await db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(eq(events.slug, parsed.data.slug))
    .limit(1);

  const event = rows[0];
  if (!event) return { ok: false, message: "That event no longer exists." };

  if (event.name.trim() !== parsed.data.confirmationName) {
    return { ok: false, message: "The name doesn't match." };
  }

  await db.delete(events).where(eq(events.id, event.id));

  revalidatePath("/admin/events");
  revalidatePath("/checkin");
  return { ok: true, slug: parsed.data.slug };
}

const revokeCheckinSchema = z.strictObject({
  slug: eventSlugSchema,
  userId: z.uuid(),
});

/**
 * Undoes a mis-scan. The check-in row goes, but a `reverted` entry is appended
 * to the scan log — an audit trail you can delete from isn't one.
 */
export async function revokeCheckInAction(
  input: unknown,
): Promise<EventActionResult> {
  const organizer = await requireOrganizer();

  const parsed = revokeCheckinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const { slug, userId } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: events.id })
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    const event = rows[0];
    if (!event)
      return { ok: false as const, message: "That event no longer exists." };

    const deleted = await tx
      .delete(eventCheckins)
      .where(
        and(
          eq(eventCheckins.eventId, event.id),
          eq(eventCheckins.userId, userId),
        ),
      )
      .returning({ id: eventCheckins.id });

    if (!deleted[0]) {
      return {
        ok: false as const,
        message: "They aren't checked in to this event.",
      };
    }

    await tx.insert(eventScanLog).values({
      eventId: event.id,
      userId,
      scannedBy: organizer.id,
      outcome: "reverted",
    });

    return { ok: true as const, slug };
  });

  if (!result.ok) return result;

  revalidatePath(`/admin/events/${slug}`);
  revalidatePath("/admin/events");
  return { ok: true, slug };
}
