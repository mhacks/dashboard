"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
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
import {
  LIVE_ANNOUNCEMENT_TONES,
  LIVE_CONTENT_STATUSES,
  LIVE_EVENT_RESOURCE_KINDS,
} from "@/lib/live/types";

export type LiveSiteActionResult =
  { ok: true; id?: string } | { ok: false; error: string };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const optionalUrl = z
  .string()
  .trim()
  .max(2_048)
  .refine(
    (value) => value === "" || z.url().safeParse(value).success,
    "Enter a valid URL.",
  )
  .transform((value) => value || null);

const optionalDateTime = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || !Number.isNaN(Date.parse(value)),
    "Enter a valid date and time.",
  )
  .transform((value) => (value ? new Date(value).toISOString() : null));

const requiredDateTime = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Enter a valid date and time.",
  })
  .transform((value) => new Date(value).toISOString());

const statusSchema = z.enum(LIVE_CONTENT_STATUSES);
const uuidSchema = z.uuid();

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const settingsSchema = z.object({
  eventName: z.string().trim().min(1).max(80),
  heroTitle: z.string().trim().min(1).max(80),
  heroDescription: z.string().trim().min(1).max(280),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine(isValidTimezone, "Enter a valid IANA timezone."),
  devpostUrl: optionalUrl,
  guideEmptyTitle: z.string().trim().min(1).max(120),
  guideEmptyDescription: z.string().trim().min(1).max(400),
  prizesEmptyTitle: z.string().trim().min(1).max(120),
  prizesEmptyDescription: z.string().trim().min(1).max(400),
});

const eventSchema = z
  .object({
    id: z.union([uuidSchema, z.literal("")]).optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "Use lowercase letters, numbers, and hyphens for the slug.",
      }),
    name: z.string().trim().min(1).max(160),
    summary: z.string().trim().max(280),
    description: z.string().trim().max(4_000),
    startsAt: requiredDateTime,
    endsAt: optionalDateTime,
    location: z.string().trim().min(1).max(160),
    locationDetails: z.string().trim().max(500),
    mapUrl: optionalUrl,
    eventType: z.string().trim().min(1).max(80),
    hostName: optionalText(160),
    audience: optionalText(160),
    capacity: z
      .union([z.number().int().positive().max(100_000), z.null()])
      .default(null),
    featured: z.boolean().default(false),
    status: statusSchema,
    position: z.number().int().min(0).max(100_000),
    resources: z
      .array(
        z.object({
          id: z.union([uuidSchema, z.literal("")]).optional(),
          kind: z.enum(LIVE_EVENT_RESOURCE_KINDS),
          label: z.string().trim().min(1).max(120),
          href: optionalUrl,
          position: z.number().int().min(0).max(100_000),
        }),
      )
      .max(20),
  })
  .refine(
    ({ startsAt, endsAt }) =>
      !endsAt || new Date(endsAt).getTime() > new Date(startsAt).getTime(),
    { message: "End time must be after the start time.", path: ["endsAt"] },
  );

const announcementSchema = z
  .object({
    id: z.union([uuidSchema, z.literal("")]).optional(),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(2_000),
    tone: z.enum(LIVE_ANNOUNCEMENT_TONES),
    status: statusSchema,
    publishedAt: optionalDateTime,
    expiresAt: optionalDateTime,
    position: z.number().int().min(0).max(100_000),
  })
  .refine(
    ({ publishedAt, expiresAt }) =>
      !publishedAt ||
      !expiresAt ||
      new Date(expiresAt).getTime() > new Date(publishedAt).getTime(),
    {
      message: "Expiration must be after publication.",
      path: ["expiresAt"],
    },
  );

const guideLinkSchema = z.object({
  id: z.union([uuidSchema, z.literal("")]).optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1_000),
  href: z.url().max(2_048),
  category: z.string().trim().min(1).max(80),
  status: statusSchema,
  position: z.number().int().min(0).max(100_000),
});

const prizeSchema = z.object({
  id: z.union([uuidSchema, z.literal("")]).optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000),
  sponsor: optionalText(160),
  value: optionalText(160),
  eligibility: z.string().trim().max(1_000),
  judgingCriteria: z.string().trim().max(2_000),
  href: optionalUrl,
  status: statusSchema,
  position: z.number().int().min(0).max(100_000),
});

function validationError(error: z.ZodError): LiveSiteActionResult {
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Check the submitted fields.",
  };
}

function databaseError(error: unknown): LiveSiteActionResult {
  console.error("Unable to update live-site content:", error);
  return {
    ok: false,
    error:
      error instanceof Error && error.message.includes("slug")
        ? "That event slug is already in use."
        : "The live site could not be updated.",
  };
}

function revalidateLiveSite() {
  revalidatePath("/live");
  revalidatePath("/admin/live");
  revalidatePath("/admin/events");
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
}

export async function saveLiveSiteSettings(
  input: unknown,
): Promise<LiveSiteActionResult> {
  const organizer = await requireOrganizer();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    await db
      .insert(liveSiteSettings)
      .values({
        id: "default",
        ...parsed.data,
        updatedByUserId: organizer.id,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: liveSiteSettings.id,
        set: {
          ...parsed.data,
          updatedByUserId: organizer.id,
          updatedAt: new Date().toISOString(),
        },
      });
    revalidateLiveSite();
    return { ok: true };
  } catch (error) {
    return databaseError(error);
  }
}

export async function saveLiveEvent(
  input: unknown,
): Promise<LiveSiteActionResult> {
  const organizer = await requireOrganizer();
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { id, resources, ...event } = parsed.data;
  const updatedAt = new Date().toISOString();

  try {
    const eventId = await db.transaction(async (tx) => {
      const eventValues = {
        slug: event.slug,
        name: event.name,
        description: event.summary || null,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        updatedAt,
      };
      const detailValues = {
        description: event.description,
        locationDetails: event.locationDetails,
        mapUrl: event.mapUrl,
        eventType: event.eventType,
        hostName: event.hostName,
        audience: event.audience,
        capacity: event.capacity,
        featured: event.featured,
        status: event.status,
        position: event.position,
        updatedByUserId: organizer.id,
        updatedAt,
      };

      const [saved] = id
        ? await tx
            .update(events)
            .set(eventValues)
            .where(eq(events.id, id))
            .returning({ id: events.id })
        : await tx
            .insert(events)
            .values({
              ...eventValues,
              createdBy: organizer.id,
              isActive: false,
            })
            .returning({ id: events.id });

      if (!saved) throw new Error("Event was not found.");

      await tx
        .insert(liveEventDetails)
        .values({
          eventId: saved.id,
          ...detailValues,
          createdByUserId: organizer.id,
        })
        .onConflictDoUpdate({
          target: liveEventDetails.eventId,
          set: detailValues,
        });

      await tx
        .delete(liveEventResources)
        .where(eq(liveEventResources.eventId, saved.id));

      if (resources.length > 0) {
        await tx.insert(liveEventResources).values(
          resources.map((resource) => ({
            eventId: saved.id,
            kind: resource.kind,
            label: resource.label,
            url: resource.href,
            position: resource.position,
            updatedAt,
          })),
        );
      }

      return saved.id;
    });

    revalidateLiveSite();
    return { ok: true, id: eventId };
  } catch (error) {
    return databaseError(error);
  }
}

export async function saveLiveAnnouncement(
  input: unknown,
): Promise<LiveSiteActionResult> {
  const organizer = await requireOrganizer();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { id, ...announcement } = parsed.data;
  const publishedAt =
    announcement.status === "published" && !announcement.publishedAt
      ? new Date().toISOString()
      : announcement.publishedAt;
  const values = {
    ...announcement,
    publishedAt,
    updatedByUserId: organizer.id,
    updatedAt: new Date().toISOString(),
  };

  try {
    const [saved] = id
      ? await db
          .update(liveAnnouncements)
          .set(values)
          .where(eq(liveAnnouncements.id, id))
          .returning({ id: liveAnnouncements.id })
      : await db
          .insert(liveAnnouncements)
          .values({ ...values, createdByUserId: organizer.id })
          .returning({ id: liveAnnouncements.id });
    if (!saved) return { ok: false, error: "Announcement was not found." };
    revalidateLiveSite();
    return { ok: true, id: saved.id };
  } catch (error) {
    return databaseError(error);
  }
}

export async function saveLiveGuideLink(
  input: unknown,
): Promise<LiveSiteActionResult> {
  const organizer = await requireOrganizer();
  const parsed = guideLinkSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { id, href, ...guideLink } = parsed.data;
  const values = {
    ...guideLink,
    url: href,
    updatedByUserId: organizer.id,
    updatedAt: new Date().toISOString(),
  };

  try {
    const [saved] = id
      ? await db
          .update(liveGuideLinks)
          .set(values)
          .where(eq(liveGuideLinks.id, id))
          .returning({ id: liveGuideLinks.id })
      : await db
          .insert(liveGuideLinks)
          .values({ ...values, createdByUserId: organizer.id })
          .returning({ id: liveGuideLinks.id });
    if (!saved) return { ok: false, error: "Guide link was not found." };
    revalidateLiveSite();
    return { ok: true, id: saved.id };
  } catch (error) {
    return databaseError(error);
  }
}

export async function saveLivePrize(
  input: unknown,
): Promise<LiveSiteActionResult> {
  const organizer = await requireOrganizer();
  const parsed = prizeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const { id, href, ...prize } = parsed.data;
  const values = {
    ...prize,
    url: href,
    updatedByUserId: organizer.id,
    updatedAt: new Date().toISOString(),
  };

  try {
    const [saved] = id
      ? await db
          .update(livePrizes)
          .set(values)
          .where(eq(livePrizes.id, id))
          .returning({ id: livePrizes.id })
      : await db
          .insert(livePrizes)
          .values({ ...values, createdByUserId: organizer.id })
          .returning({ id: livePrizes.id });
    if (!saved) return { ok: false, error: "Prize was not found." };
    revalidateLiveSite();
    return { ok: true, id: saved.id };
  } catch (error) {
    return databaseError(error);
  }
}

async function archiveRecord(
  id: unknown,
  table: typeof liveAnnouncements | typeof liveGuideLinks | typeof livePrizes,
): Promise<LiveSiteActionResult> {
  const organizer = await requireOrganizer();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const [archived] = await db
      .update(table)
      .set({
        status: "archived",
        updatedByUserId: organizer.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(table.id, parsed.data))
      .returning({ id: table.id });
    if (!archived) return { ok: false, error: "Content was not found." };
    revalidateLiveSite();
    return { ok: true, id: archived.id };
  } catch (error) {
    return databaseError(error);
  }
}

export async function archiveLiveEvent(
  id: unknown,
): Promise<LiveSiteActionResult> {
  const organizer = await requireOrganizer();
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const [archived] = await db
      .update(liveEventDetails)
      .set({
        status: "archived",
        updatedByUserId: organizer.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(liveEventDetails.eventId, parsed.data))
      .returning({ id: liveEventDetails.eventId });
    if (!archived) return { ok: false, error: "Event was not found." };
    revalidateLiveSite();
    return { ok: true, id: archived.id };
  } catch (error) {
    return databaseError(error);
  }
}

export async function archiveLiveAnnouncement(id: unknown) {
  return archiveRecord(id, liveAnnouncements);
}

export async function archiveLiveGuideLink(id: unknown) {
  return archiveRecord(id, liveGuideLinks);
}

export async function archiveLivePrize(id: unknown) {
  return archiveRecord(id, livePrizes);
}
