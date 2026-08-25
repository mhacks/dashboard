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
 * datetime-local inputs submit "2026-10-10T18:00" with no zone. Postgres reads
 * that in the server's timezone, which is what an organizer typing a local
 * start time means.
 */
const optionalTimestamp = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .refine(
    (value) => value === null || !Number.isNaN(Date.parse(value)),
    "Enter a valid date and time.",
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
