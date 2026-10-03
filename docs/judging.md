# Judging

Judging runs on [MDredd](https://github.com/mhacks/MDredd), a pairwise judging
API. The dashboard is its only client: judges vote at `/judge`, and organizers
run it from **Admin → Teams and reservations → Judging**
(`/admin/teams/judging`). Every MDredd call happens on the server, because its
token is one shared secret for the whole API.

## Setup

Configure these locally or as SecureString parameters under `/mhacks-secrets/`
for ECS:

| Variable           | Value                                                 |
| ------------------ | ----------------------------------------------------- |
| `MDREDD_API_URL`   | MDredd's base URL, e.g. `https://judging.example.com` |
| `MDREDD_API_TOKEN` | MDredd's `MDREDD_API_TOKEN`                           |

Without them, both pages say judging is not set up.

## Event flow

1. Teams reserve a table and save their Devpost project link on
   `/dashboard/team`.
2. An organizer downloads the projects CSV from Devpost and uploads it on the
   judging page. MDredd follows each submission link to its public
   `devpost.com/software/...` page, stores it, and starts judging. The dashboard
   then sends MDredd every seated team's link and table number.
3. If Devpost asks for a login (the gallery is still private), the upload lists
   every row as failed and nothing is stored. Publish the gallery, or set
   `MDREDD_DEVPOST_COOKIE` on MDredd, and upload again.
4. Judges open `/judge`. Each gets two projects with their team and table,
   picks the stronger one, and gets the next pair. A team that isn't at its
   table is marked absent; a project absent several times in a row leaves the
   draw until an organizer restores it on the judging page.
5. The judging page ranks projects strongest first. **Export CSV** downloads
   every project's Devpost columns with its `Project Url` and `Table Number`.

## Matching projects to teams

A project matches the team whose saved Devpost link is the same page as the
project's resolved URL, ignoring case, `www.`, a trailing slash, the query, and
the scheme (`lib/judging/url.ts`, mirroring MDredd). The judging page lists
projects that have no table and team links that match no project. A team that
saved its `.../submissions/...` link instead of its public project link will not
match.

Judges always see the dashboard's current tables. MDredd's copy, used only for
the export, is refreshed after each upload, before each export, and by **Sync
tables**.

## Rate limits

MDredd limits pair requests and votes per judge (each judge's dashboard user
id), so judges do not slow each other down. A judge who requests pairs or votes
faster than that sees a short wait on `/judge`, which then loads the next pair
on its own. Admin actions (upload, start, stop, restore, table sync) share one
limit of a few calls per minute.
