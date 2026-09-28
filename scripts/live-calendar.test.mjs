import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import {
  buildSyncStatements,
  parseCalendar,
  renderSql,
  SOURCE_PREFIX,
} from "./lib/live-calendar.mjs";

const calendar = (...events) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const event = (uid = "sync-test-a", extra = "", title = "Sync test workshop") =>
  [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "DTSTART:20261003T170000Z",
    "DTEND:20261003T180000Z",
    `SUMMARY:${title}`,
    extra,
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\r\n");

test("UTC dates, missing locations, and folded/escaped text are preserved", () => {
  const [row] = parseCalendar(
    calendar(
      event(
        "a",
        "DESCRIPTION:Hello\\nworld\\, yes",
        "Build Your Entire App in 30 M\r\n inutes",
      ),
    ),
  );
  assert.equal(row.name, "Build Your Entire App in 30 Minutes");
  assert.equal(row.description, "Hello\nworld, yes");
  assert.equal(row.location, null);
  assert.equal(row.starts_at, "2026-10-03T17:00:00.000Z");
});

test("UID identity survives title, time, and location changes", () => {
  const [first] = parseCalendar(calendar(event()));
  const [updated] = parseCalendar(
    calendar(
      event("sync-test-a", "LOCATION:New room", "Renamed").replaceAll(
        "170000Z",
        "173000Z",
      ),
    ),
  );
  assert.equal(first.slug, updated.slug);
  assert(first.slug.startsWith(SOURCE_PREFIX));
});

test("same titles at different times remain distinct", () => {
  const rows = parseCalendar(
    calendar(event("a"), event("b").replaceAll("170000Z", "173000Z")),
  );
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].slug, rows[1].slug);
});

test("duplicate UIDs and duplicate title/time entries are rejected", () => {
  assert.throws(
    () => parseCalendar(calendar(event(), event())),
    /duplicate calendar UID/,
  );
  assert.throws(
    () => parseCalendar(calendar(event("a"), event("b"))),
    /Duplicate title and start time/,
  );
});

test("empty, malformed, recurring, and all-day calendars fail closed", () => {
  assert.throws(() => parseCalendar(calendar()), /empty/);
  assert.throws(() => parseCalendar("not a calendar"));
  assert.throws(
    () => parseCalendar(calendar(event("a", "RRULE:FREQ=DAILY"))),
    /Recurring/,
  );
  assert.throws(
    () =>
      parseCalendar(
        calendar(
          event().replace(
            "DTSTART:20261003T170000Z",
            "DTSTART;VALUE=DATE:20261003",
          ),
        ),
      ),
    /all-day/,
  );
});

test("floating/unknown timezones and invalid ranges are rejected", () => {
  assert.throws(
    () =>
      parseCalendar(
        calendar(
          event().replace(
            "DTSTART:20261003T170000Z",
            "DTSTART:20261003T170000",
          ),
        ),
      ),
    /timezone/,
  );
  assert.throws(
    () =>
      parseCalendar(
        calendar(
          event().replace(
            "DTSTART:20261003T170000Z",
            "DTSTART;TZID=Unknown:20261003T170000",
          ),
        ),
      ),
    /timezone/,
  );
  assert.throws(
    () => parseCalendar(calendar(event().replace("180000Z", "160000Z"))),
    /Invalid duration/,
  );
  assert.throws(
    () => parseCalendar(calendar(event().replaceAll("20261003", "20261006"))),
    /outside October/,
  );
});

test("embedded timezone definitions are honored", () => {
  const zone = [
    "BEGIN:VTIMEZONE",
    "TZID:Test/Eastern",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0400",
    "END:STANDARD",
    "END:VTIMEZONE",
  ].join("\r\n");
  const zoned = event()
    .replace(
      "DTSTART:20261003T170000Z",
      "DTSTART;TZID=Test/Eastern:20261003T130000",
    )
    .replace(
      "DTEND:20261003T180000Z",
      "DTEND;TZID=Test/Eastern:20261003T140000",
    );
  assert.equal(
    parseCalendar(calendar(zone, zoned))[0].starts_at,
    "2026-10-03T17:00:00.000Z",
  );
});

test("cancellations need only UID; an all-cancelled feed is rejected", () => {
  const cancelled =
    "BEGIN:VEVENT\r\nUID:cancelled\r\nSTATUS:CANCELLED\r\nEND:VEVENT";
  const rows = parseCalendar(calendar(event(), cancelled));
  assert.equal(rows.filter((row) => row.cancelled).length, 1);
  assert.throws(() => parseCalendar(calendar(cancelled)), /No active events/);
});

test("SQL export is transactional and does not overwrite check-in or enriched details", () => {
  const statements = buildSyncStatements(parseCalendar(calendar(event())), {
    publish: true,
  });
  const sql = renderSql(statements);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
  assert.match(sql, /'published'::public.live_content_status/);
  assert.match(sql, /ON CONFLICT \(event_id\) DO NOTHING/);
  assert.doesNotMatch(
    sql,
    /DELETE FROM|UPDATE public\.event_checkins|requires_rsvp\s*=|is_active\s*=/i,
  );
});

test("oversized feeds are refused", () => {
  assert.throws(() => parseCalendar("x".repeat(2_000_001)), /too large/);
});

test(
  "real database: repeat sync, edits, cancellations, archives, duplicate guard, and SQL escaping",
  {
    skip:
      !process.env.LIVE_SYNC_TEST_DATABASE_URL &&
      "Set LIVE_SYNC_TEST_DATABASE_URL to a local migrated database",
  },
  async () => {
    const url = new URL(process.env.LIVE_SYNC_TEST_DATABASE_URL);
    assert(
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
      "Database tests must be local",
    );
    const db = postgres(url.toString(), {
      prepare: false,
      max: 1,
      connect_timeout: 10,
    });
    const rollback = new Error("test transaction rollback");
    try {
      await assert.rejects(
        db.begin(async (tx) => {
          const run = async (rows, options) => {
            let result;
            for (const statement of buildSyncStatements(rows, options))
              result = await tx.unsafe(statement);
            return Object.fromEntries(
              result.map((row) => [row.action, row.count]),
            );
          };
          const original = parseCalendar(calendar(event()));
          const slug = original[0].slug;
          const existing =
            await tx`SELECT id FROM public.events WHERE slug = ${slug}`;
          assert.equal(
            existing.length,
            0,
            "Test UID already exists; will not overwrite it",
          );
          assert.equal((await run(original, { publish: true })).insert, 1);
          const [first] =
            await tx`SELECT * FROM public.events WHERE slug = ${slug}`;
          assert.equal(first.is_active, false);
          const [details] =
            await tx`SELECT * FROM public.live_event_details WHERE event_id = ${first.id}`;
          assert.equal(details.status, "published");
          assert.equal((await run(original)).unchanged, 1);
          const [again] =
            await tx`SELECT * FROM public.events WHERE id = ${first.id}`;
          assert.deepEqual(again, first);
          await tx`UPDATE public.events SET is_active = true, requires_rsvp = false WHERE id = ${first.id}`;
          await tx`UPDATE public.live_event_details SET status = 'draft', description = 'Organizer details', event_type = 'Workshop', capacity = 25 WHERE event_id = ${first.id}`;
          const edited = [
            {
              ...original[0],
              name: "Renamed workshop",
              location: "New room",
              description: "Quotes: ' $calendar$ \\ ; SELECT 1;",
              starts_at: "2026-10-03T17:30:00.000Z",
            },
          ];
          assert.equal((await run(edited, { publish: true })).update, 1);
          const [after] =
            await tx`SELECT e.*, d.status, d.description AS details, d.capacity, d.event_type FROM public.events e JOIN public.live_event_details d ON d.event_id = e.id WHERE e.id = ${first.id}`;
          assert.equal(after.name, edited[0].name);
          assert.equal(after.description, edited[0].description);
          assert.equal(after.is_active, true);
          assert.equal(after.requires_rsvp, false);
          assert.equal(after.status, "draft");
          assert.equal(after.details, "Organizer details");
          assert.equal(after.capacity, 25);
          assert.equal(after.event_type, "Workshop");
          await tx.savepoint(async (savepoint) => {
            await savepoint`SET LOCAL ROLE anon`;
            assert.equal(
              (
                await savepoint`SELECT id FROM public.events WHERE id = ${first.id}`
              ).length,
              0,
            );
            await savepoint`RESET ROLE`;
          });
          const other = parseCalendar(
            calendar(event("sync-test-b", "", "Other test event")),
          );
          await run([
            ...other,
            { uid: original[0].uid, slug, cancelled: true },
          ]);
          assert.equal(
            (
              await tx`SELECT status FROM public.live_event_details WHERE event_id = ${first.id}`
            )[0].status,
            "archived",
          );
          await tx`UPDATE public.live_event_details SET status = 'draft' WHERE event_id = ${first.id}`;
          await run(other);
          assert.equal(
            (
              await tx`SELECT status FROM public.live_event_details WHERE event_id = ${first.id}`
            )[0].status,
            "draft",
          );
          await run(other, { archiveMissing: true });
          assert.equal(
            (
              await tx`SELECT status FROM public.live_event_details WHERE event_id = ${first.id}`
            )[0].status,
            "archived",
          );
          await run([
            ...other,
            { uid: original[0].uid, slug, cancelled: true },
          ]);
          assert.equal(
            (await tx`SELECT id FROM public.events WHERE id = ${first.id}`)
              .length,
            1,
          );
          const conflict = parseCalendar(
            calendar(event("sync-test-conflict", "", "Conflict event")),
          );
          await tx`INSERT INTO public.events (slug, name, starts_at) VALUES ('sync-test-manual-conflict', ${conflict[0].name}, ${conflict[0].starts_at})`;
          await assert.rejects(
            tx.savepoint(async (savepoint) => {
              for (const statement of buildSyncStatements(conflict))
                await savepoint.unsafe(statement);
            }),
            /existing event matches/,
          );
          assert.equal(
            (
              await tx`SELECT id FROM public.events WHERE slug = ${conflict[0].slug}`
            ).length,
            0,
          );
          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await db.end({ timeout: 5 });
    }
  },
);
