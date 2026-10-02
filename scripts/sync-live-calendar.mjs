import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import postgres from "postgres";
import {
  buildSyncStatements,
  downloadCalendar,
  parseCalendar,
  renderSql,
  SOURCE_PREFIX,
} from "../supabase/functions/_shared/live-calendar.mjs";

async function main() {
  const { values: options } = parseArgs({
    options: {
      help: { type: "boolean" },
      file: { type: "string" },
      sql: { type: "string" },
      apply: { type: "boolean", default: false },
      publish: { type: "boolean", default: false },
      "allow-remote": { type: "boolean", default: false },
      "archive-missing": { type: "boolean", default: false },
    },
  });
  if (options.help) {
    console.log(`Usage: pnpm live:sync [options]

Default: fetch the MHacks calendar and preview changes without writing.
  --file PATH         Read an exported .ics instead of downloading the calendar
  --apply             Apply changes to DATABASE_URL in one transaction
  --publish           Publish newly imported events; retain existing visibility
  --allow-remote      Required with --apply for a non-local database
  --archive-missing   Archive this calendar's missing events; never delete them
  --sql PATH          Export a reviewed transaction for Supabase's SQL Editor

New scanners stay closed. Existing check-in and RSVP settings are untouched.
SQL export is not execution. No database connection is needed for --sql.
See docs/live-site.md for ownership, backups, and production instructions.`);
    return;
  }
  if (options.sql && options.apply)
    throw new Error("Choose --sql or --apply, not both.");
  let source;
  if (options.file) {
    source = await readFile(options.file, "utf8");
  } else {
    source = await downloadCalendar();
  }
  const events = parseCalendar(source);
  const active = events.filter((event) => !event.cancelled);
  console.log(
    `${active.length} scheduled events; ${events.length - active.length} cancellations.`,
  );
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  console.table(
    active.map((event) => ({
      title: event.name,
      start: format.format(new Date(event.starts_at)),
      end: format.format(new Date(event.ends_at)),
      location: event.location || "Not provided",
    })),
  );
  const statements = buildSyncStatements(events, {
    publish: options.publish,
    archiveMissing: options["archive-missing"],
  });
  if (options.sql) {
    await writeFile(options.sql, renderSql(statements), {
      flag: "wx",
      mode: 0o600,
    });
    console.log(`SQL exported to ${options.sql}. No database changes made.`);
    return;
  }
  if (!process.env.DATABASE_URL) {
    if (options.apply) throw new Error("DATABASE_URL is required for --apply.");
    console.log(
      "No DATABASE_URL: source preview only; existing database events not checked.",
    );
    return;
  }
  const target = new URL(process.env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(target.protocol))
    throw new Error("Expected a PostgreSQL DATABASE_URL.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  if (options.apply && !local && !options["allow-remote"]) {
    throw new Error(
      "Remote writes require --apply --allow-remote. Preview first.",
    );
  }
  console.log(
    `Database: ${target.hostname}:${target.port || "5432"}${target.pathname}`,
  );
  const db = postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
    ...(local ? {} : { ssl: "verify-full" }),
  });
  try {
    const existing = await db`
      SELECT to_jsonb(e) AS event, to_jsonb(d) AS details
      FROM public.events e LEFT JOIN public.live_event_details d ON d.event_id = e.id
      WHERE e.slug LIKE ${SOURCE_PREFIX + "%"}
        OR lower(btrim(e.name)) IN ${db(active.map((event) => event.name.trim().toLowerCase()))}`;
    if (!options.apply) {
      const owned = existing.filter((row) =>
        row.event.slug.startsWith(SOURCE_PREFIX),
      );
      const known = new Set(owned.map((row) => row.event.slug));
      const incoming = new Set(events.map((event) => event.slug));
      console.log(
        `${active.filter((event) => !known.has(event.slug)).length} new; ${active.filter((event) => known.has(event.slug)).length} existing calendar events.`,
      );
      console.log(
        `${owned.filter((row) => !incoming.has(row.event.slug)).length} calendar events missing from this export (${options["archive-missing"] ? "would archive" : "kept"}).`,
      );
      const possibleMatches = existing.filter(
        (row) => !known.has(row.event.slug),
      );
      if (possibleMatches.length) {
        console.log(
          "Existing non-calendar events with matching titles: review before applying.",
        );
        console.table(
          possibleMatches.map((row) => ({
            name: row.event.name,
            start: row.event.starts_at,
            slug: row.event.slug,
          })),
        );
      }
      console.log("Dry run complete. No database changes made.");
      return;
    }
    const backup = await mkdtemp(join(tmpdir(), "mhacks-calendar-backup-"));
    await writeFile(
      join(backup, "before.json"),
      JSON.stringify(existing, null, 2),
      { mode: 0o600 },
    );
    await writeFile(join(backup, "source.ics"), source, { mode: 0o600 });
    console.log(`Saved pre-import content and calendar to ${backup}`);
    const result = await db.begin(async (tx) => {
      let changes;
      for (const statement of statements) changes = await tx.unsafe(statement);
      return changes;
    });
    console.table(result);
    console.log(
      "Sync committed. Existing check-in settings and attendance were preserved.",
    );
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch((error) => {
  // Database errors can include query text; report the message, not the query or credentials.
  console.error(`Calendar sync failed: ${error.message}`);
  process.exitCode = 1;
});
