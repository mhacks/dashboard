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

## Smoke test

Check signed-out access, day selection, search, event details, and links on both
desktop and mobile. Verify that drafts, archived rows, future announcements,
and expired announcements are hidden. Edit a published item's text in the local
database and reload `/live` to confirm the change appears without redeploying.
