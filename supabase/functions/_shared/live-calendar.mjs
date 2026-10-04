import { createHash, randomBytes } from "node:crypto";
import ICAL from "ical.js";

export const CALENDAR_ID =
  "c_53afe4132445b91db44446786620e461c089ec2d662341af84d97632c556f6ca@group.calendar.google.com";
export const CALENDAR_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;
export const MAX_CALENDAR_BYTES = 2_000_000;
const hash = (value) => createHash("sha256").update(value).digest("hex");
export const SOURCE_PREFIX = `gcal-${hash(CALENDAR_ID).slice(0, 16)}-`;

/** Downloads the public feed, refusing anything over MAX_CALENDAR_BYTES. */
export async function downloadCalendar() {
  const response = await fetch(CALENDAR_URL, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`Calendar download failed (${response.status}).`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_CALENDAR_BYTES)
      throw new Error("Calendar download exceeded size limit.");
    chunks.push(chunk);
  }
  return new Blob(chunks).text();
}

export function parseCalendar(source) {
  if (new TextEncoder().encode(source).length > MAX_CALENDAR_BYTES) {
    throw new Error("Calendar is too large; refusing import.");
  }
  const calendar = new ICAL.Component(ICAL.parse(source));
  if (calendar.name !== "vcalendar") throw new Error("Expected a VCALENDAR.");
  ICAL.TimezoneService.reset();
  for (const zone of calendar.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(zone);
  }
  const components = calendar.getAllSubcomponents("vevent");
  if (!components.length || components.length > 500) {
    throw new Error(
      "Expected 1-500 events; refusing an empty or oversized feed.",
    );
  }
  const seen = new Set();
  const signatures = new Set();
  const events = components.map((component) => {
    const event = new ICAL.Event(component);
    if (!event.uid || seen.has(event.uid)) {
      throw new Error(
        "Missing or duplicate calendar UID; resolve before syncing.",
      );
    }
    seen.add(event.uid);
    if (event.isRecurring() || event.isRecurrenceException()) {
      throw new Error(`Recurring events need explicit expansion: ${event.uid}`);
    }
    const slug = SOURCE_PREFIX + hash(event.uid).slice(0, 32);
    const status = component.getFirstPropertyValue("status");
    if (status === "CANCELLED")
      return { uid: event.uid, slug, cancelled: true };
    if (status && !["CONFIRMED", "TENTATIVE"].includes(status)) {
      throw new Error(`Unsupported event status: ${status}`);
    }
    if (!event.summary?.trim()) throw new Error(`Missing title: ${event.uid}`);
    for (const key of ["dtstart", "dtend"]) {
      const time = component.getFirstPropertyValue(key);
      if (!time || time.isDate || time.zone === ICAL.Timezone.localTimezone) {
        throw new Error(
          `Missing, all-day, or unresolved timezone in ${key}: ${event.summary}`,
        );
      }
    }
    const start = event.startDate.toJSDate();
    const end = event.endDate.toJSDate();
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start ||
      start < new Date("2026-10-03T00:00:00-04:00") ||
      end > new Date("2026-10-05T00:00:00-04:00")
    ) {
      throw new Error(
        `Invalid duration or date outside October 3-4: ${event.summary}`,
      );
    }
    const row = {
      uid: event.uid,
      slug,
      name: event.summary,
      description: event.description || "",
      location: event.location || null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      cancelled: false,
    };
    if (
      Object.values(row).some(
        (value) => typeof value === "string" && value.includes("\0"),
      )
    ) {
      throw new Error(`Invalid null character: ${event.uid}`);
    }
    const signature = JSON.stringify([
      row.name.trim().toLowerCase(),
      row.starts_at,
    ]);
    if (signatures.has(signature)) {
      throw new Error(`Duplicate title and start time: ${event.summary}`);
    }
    signatures.add(signature);
    return row;
  });
  if (events.every((event) => event.cancelled)) {
    throw new Error(
      "No active events; refusing to archive the whole calendar.",
    );
  }
  return events.sort((a, b) =>
    (a.starts_at || "").localeCompare(b.starts_at || ""),
  );
}

// Dollar quoting keeps calendar text (including quotes and backslashes) inert in
// both the database-client path and the standalone Supabase SQL export.
function literal(value) {
  const text = String(value);
  let tag = "$calendar$";
  while (text.includes(tag))
    tag = `$calendar_${randomBytes(8).toString("hex")}$`;
  return `${tag}${text}${tag}`;
}

/**
 * @param {object} [options]
 * @param {boolean} [options.publish] New live entries start published, not draft.
 * @param {boolean} [options.archiveMissing] Archive calendar events no longer in the feed.
 * @param {boolean} [options.restoreArchived] Republish archived calendar events
 *   that are back in the feed, so /live follows the calendar both ways.
 * @param {boolean} [options.guardMassArchive] Refuse a sync that would archive
 *   more than half of the calendar's live events (and more than 3) — the shape
 *   of a truncated feed, not of organizers editing the schedule.
 */
export function buildSyncStatements(
  events,
  {
    publish = false,
    archiveMissing = false,
    restoreArchived = false,
    guardMassArchive = false,
  } = {},
) {
  if (!events.length) throw new Error("Refusing an empty import.");
  const suffix = randomBytes(6).toString("hex");
  const incoming = `calendar_incoming_${suffix}`;
  const changes = `calendar_changes_${suffix}`;
  const prefix = literal(SOURCE_PREFIX + "%");
  return [
    "SET LOCAL lock_timeout = '10s'",
    "SET LOCAL statement_timeout = '60s'",
    `SELECT pg_advisory_xact_lock(hashtextextended(${literal(SOURCE_PREFIX)}, 0))`,
    `CREATE TEMP TABLE ${incoming} ON COMMIT DROP AS
      SELECT * FROM jsonb_to_recordset(${literal(JSON.stringify(events))}::jsonb)
      AS rows(uid text, slug text, name text, description text, location text,
        starts_at timestamptz, ends_at timestamptz, cancelled boolean)`,
    // Refuse to duplicate an event an organizer created by hand. Calendar
    // events are left out: the feed sets their final state (parseCalendar
    // already rejects a duplicate within it), and comparing their old times
    // would refuse an event moving into a slot another one is leaving. So are
    // archived events, which are hidden from /live: an event recreated or
    // moved under a new calendar UID lands on its archived former self.
    `DO $guard$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM ${incoming} incoming JOIN public.events existing
            ON lower(btrim(existing.name)) = lower(btrim(incoming.name))
            AND existing.starts_at = incoming.starts_at
            AND existing.slug <> incoming.slug
          LEFT JOIN public.live_event_details details
            ON details.event_id = existing.id
          WHERE NOT incoming.cancelled
            AND existing.slug NOT LIKE ${prefix}
            AND details.status IS DISTINCT FROM 'archived'
        ) THEN
          RAISE EXCEPTION 'An event not created by the calendar has the same title and start time as a calendar event. Rename, move, or archive one of them; no changes were applied.';
        END IF;
      END $guard$`,
    `CREATE TEMP TABLE ${changes} ON COMMIT DROP AS
      SELECT incoming.slug, incoming.name,
        CASE WHEN existing.id IS NULL THEN 'insert'
          WHEN ${restoreArchived} AND details.status = 'archived' THEN 'restore'
          WHEN details.event_id IS NULL OR
            (existing.name, existing.description, existing.location, existing.starts_at, existing.ends_at)
            IS DISTINCT FROM
            (incoming.name, incoming.description, incoming.location, incoming.starts_at, incoming.ends_at)
          THEN 'update' ELSE 'unchanged' END AS action
      FROM ${incoming} incoming
      LEFT JOIN public.events existing USING (slug)
      LEFT JOIN public.live_event_details details ON details.event_id = existing.id
      WHERE NOT incoming.cancelled
      UNION ALL
      SELECT existing.slug, existing.name,
        CASE WHEN incoming.cancelled OR ${archiveMissing} THEN 'archive' ELSE 'missing (kept)' END
      FROM public.events existing
      JOIN public.live_event_details details ON details.event_id = existing.id
      LEFT JOIN ${incoming} incoming USING (slug)
      WHERE existing.slug LIKE ${prefix} AND details.status <> 'archived'
        AND (incoming.cancelled OR incoming.slug IS NULL)`,
    ...(guardMassArchive
      ? [
          `DO $mass_archive$
      DECLARE archiving integer; listed integer;
      BEGIN
        SELECT count(*) INTO archiving FROM ${changes} WHERE action = 'archive';
        SELECT count(*) INTO listed FROM public.events existing
          JOIN public.live_event_details details ON details.event_id = existing.id
          WHERE existing.slug LIKE ${prefix} AND details.status <> 'archived';
        IF archiving > 3 AND archiving * 2 > listed THEN
          RAISE EXCEPTION 'This sync would remove % of % calendar events from /live, which looks like an incomplete calendar feed. No changes were applied; check the calendar and try again.', archiving, listed;
        END IF;
      END $mass_archive$`,
        ]
      : []),
    `INSERT INTO public.events (slug, name, description, location, starts_at, ends_at, is_active)
      SELECT slug, name, description, location, starts_at, ends_at, false
      FROM ${incoming} WHERE NOT cancelled
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        location = EXCLUDED.location, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at
      WHERE (events.name, events.description, events.location, events.starts_at, events.ends_at)
        IS DISTINCT FROM
        (EXCLUDED.name, EXCLUDED.description, EXCLUDED.location, EXCLUDED.starts_at, EXCLUDED.ends_at)`,
    `INSERT INTO public.live_event_details (event_id, status)
      SELECT existing.id, '${publish ? "published" : "draft"}'::public.live_content_status
      FROM ${incoming} incoming JOIN public.events existing USING (slug)
      WHERE NOT incoming.cancelled
      ON CONFLICT (event_id) DO NOTHING`,
    `UPDATE public.live_event_details details SET status = 'archived'
      FROM public.events existing JOIN ${changes} changes USING (slug)
      WHERE details.event_id = existing.id AND changes.action = 'archive'
        AND details.status <> 'archived'`,
    `UPDATE public.live_event_details details SET status = 'published'
      FROM public.events existing JOIN ${changes} changes USING (slug)
      WHERE details.event_id = existing.id AND changes.action = 'restore'`,
    `SELECT action, count(*)::integer AS count FROM ${changes} GROUP BY action ORDER BY action`,
  ];
}

export function renderSql(statements) {
  return (
    "-- Generated by pnpm live:sync. Review before running in the target database.\n" +
    "-- Only calendar-owned events are updated. No events or attendance records are deleted.\n" +
    "BEGIN;\n" +
    statements.join(";\n\n") +
    ";\nCOMMIT;\n"
  );
}
