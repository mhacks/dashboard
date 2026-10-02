# Live site

The public `/live` page reads its content through the Next.js server’s Drizzle
connection (`DATABASE_URL`), not the Supabase Data API. Visitors do not need an
account. It includes the timeline,
event details, one announcement, hacker guide links, and prizes. A dedicated
organizer editor is deferred; use Supabase's Table Editor to manage content.

## Deployment

- Generate branch migrations against the latest `main` schema with
  `pnpm db:generate --name=live_site_content`. Do not create these tables by hand
  in production or use `db:push` against production.
- Run `node scripts/check-migrations.mjs`, formatting, lint, and the build before
  submitting the PR. Test migration application against a local database too;
  CI checks migration ordering but does not apply the SQL to a database.
- After a reviewed merge to `main`, the existing deployment workflow applies
  Drizzle migrations to Supabase before deploying the application. Confirm both
  deployment jobs succeed, then test `/live` while signed out.
- The migration creates the tables and default settings, but does not publish
  sample events or announcements. Populate and review real content in Supabase
  before sharing the live site publicly. Demo content lives only in
  `supabase/seeds/live-site-demo.sql` for local development.

## Editing content

Use the `public` schema in the Supabase Table Editor. Work in drafts until content
is ready. Publishing is controlled by `status`, not by the scanner's `is_active`
setting. The page reads fresh content on each page load; an already-open page
must be refreshed to see edits.

| Content                      | Table                  | Notes                                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site settings                | `live_site_settings`   | Use the single row with `id = default`. Includes heading text, empty-state copy, timezone, and Devpost URL. Keep a valid IANA timezone such as `America/Detroit`.                                                                       |
| Schedule basics              | `events`               | Set a unique slug, name, summary (`description`), location, and start/end timestamps with timezone offsets. This table is shared with check-in.                                                                                         |
| Event details and publishing | `live_event_details`   | Set `event_id` to the matching `events.id`. Includes full description, location details, map URL, event type, host, audience, and capacity. Set `status = published` to show the event. A start time is also required for the timeline. |
| Event links                  | `live_event_resources` | Set `event_id` to the matching event. Includes link kind, label, URL, and display position. These follow the parent event's publishing status.                                                                                          |
| Announcement                 | `live_announcements`   | Publish a title and body. Optional `published_at` and `expires_at` control the visibility window. Only one eligible announcement appears: lowest position first, then most recent publish time. Avoid tied positions and publish times. |
| Hacker guide                 | `live_guide_links`     | Set title, URL, optional description/category, position, and publishing status.                                                                                                                                                         |
| Prizes                       | `live_prizes`          | Set title, description, optional sponsor/value/link, eligibility, judging criteria, position, and publishing status.                                                                                                                    |

- Lower `position` values appear first. Events are primarily ordered by start time.
- Announcement recency uses `published_at`, or `created_at` when no publish time
  is set.
- Use `draft` for unfinished content and `archived` to hide content without
  deleting it. Guide links and prizes appear only when published.
- Use full `https://` links. Leave optional URLs empty until the destination is
  ready. Do not place secrets or internal-only information in published rows.
- For schedule-only events, keep `events.is_active = false` unless staff intend
  to open their check-in scanner. Publishing an event should not open its scanner.
- Leave audit fields and generated IDs at their defaults unless there is a
  specific reason to set them. Never edit Supabase's internal `auth` or `storage`
  tables to manage live-site content.

### Hacker bouquets

The hero's sticker strip shows up to 10 random rows from `live_bouquets`, picked
again on every page load. Hackers add rows themselves with **share to live site**
in the bouquet game (`/dashboard/bouquet`). Each user has one row, and sharing
again replaces their arrangement. The "Made by" name comes from their
application ("Rebecca S."). With no visible rows, the page shows the photo hero.

- To pull a bouquet, set `hidden = true`. Re-sharing never clears `hidden`.
- `arrangement` is validated against the flower catalog when the page reads it.
  A row edited into an invalid shape is skipped rather than breaking the page.

## Smoke test

Check signed-out access, day selection, search, event details, and links on both
desktop and mobile. Verify that drafts, archived rows, future announcements,
and expired announcements are hidden. Edit a published item's text in the local
database and reload `/live` to confirm the change appears without redeploying.

## Syncing the Google Calendar

The MHacks 2026 calendar can be imported repeatedly without creating new event
IDs when titles or times change. The script uses the calendar UID in a stable
`gcal-...` slug, so **do not rename imported slugs**. No schema migration is needed.
The command is a one-time sync, not a background subscription.

```bash
pnpm live:sync                       # Download and preview; never writes
pnpm live:sync --file schedule.ics   # Preview a saved export of the same calendar
```

Without `DATABASE_URL`, the preview checks only the calendar. With `DATABASE_URL`,
it also reports existing events and possible conflicts. The script intentionally
does not load `.env.local` automatically, so the database target is explicit.

For a local test, set `DATABASE_URL` to your local database and run:

```bash
pnpm live:sync --apply --publish
```

For production, configure `DATABASE_URL` privately with the production connection
string, preview first, and explicitly allow the write:

```bash
pnpm live:sync
pnpm live:sync --apply --allow-remote --publish
```

Do not paste credentials in chat or commit them. Remote connections require
certificate-verified TLS. Before applying, the command saves matching event rows,
their live details, and the source calendar in a private temporary backup folder
and prints its location. The database writes are one transaction.

Alternatively, generate a transaction for Supabase's SQL Editor without needing
a local database connection. Use a new output filename each time:

```bash
pnpm live:sync --publish --sql /tmp/mhacks-calendar.sql
```

Review the target project and SQL before executing. This export does not execute
anything or make the CLI's automatic backup; export the affected event content
from Supabase before using it to update existing records. The same duplicate
checks and transactional behavior apply. Refresh `/live` after a successful sync.

### Ownership and safety

- Includes all calendar entries, including judge activities. Blank locations stay
  blank; titles and timestamps, including the 11:30 AM-noon submissions reminder,
  are preserved. Dates must fall within October 3-4, 2026 in Eastern Time.
- The calendar owns `events.name`, `description`, `location`, `starts_at`, and
  `ends_at`. Update these in Google Calendar, not Supabase, or a later sync will
  overwrite the manual change. Descriptions are imported verbatim, including any
  source boilerplate.
- Extra live details, categories, resources, capacities, existing publishing
  status, scanner settings, RSVP requirements, and attendance are preserved.
  New events use the default `Event` category and closed scanners.
- New live entries are drafts unless `--publish` is supplied. That flag publishes
  only new entries, not existing drafts or archives. Publish those manually after
  review when needed.
- Existing non-calendar events are never silently adopted or overwritten. A
  matching title and start time under a different slug aborts the whole import;
  reconcile that event deliberately before retrying.
- Explicit cancellations archive imported events. Missing entries are reported
  but kept unless `--archive-missing` is supplied. Nothing is deleted, including
  attendance. Reappearing archived entries stay archived until manually published.
- Empty feeds, duplicate IDs or title/time pairs, unsupported recurring/all-day
  entries, unresolved timezones, and invalid dates abort before any write.
