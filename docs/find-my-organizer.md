# Find my organizer

`/find-my-organizer` shows where organizers are on a map. It shows only
phones running the [OwnTracks](https://owntracks.org) app that POST their
location to `/api/owntracks`. Nothing polls Apple or anyone else, and there is
nothing to turn on in the dashboard.

## Who sees what

| Viewer             | Sees                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| Organizers         | Everyone who has reported in the last 3 hours, including stale positions, and battery. |
| Volunteers, judges | Name and position of people whose last update is under 15 minutes old. No battery.     |
| Hackers            | A 404. The page, its puzzle, and hunt codes are hidden from hackers for now.           |
| Everyone else      | A note that the page opens after check-in.                                             |

The filtering happens on the server, so hackers' browsers never receive stale
positions or battery levels. For the same reason the page doesn't read Supabase
from the browser: it re-renders through the server every 2 minutes, and right
away when a hidden tab comes back. The attendee view is cached per server task for 10 seconds,
so a hall full of open pages costs one read per task, not one per hacker.

## Setting up a phone

The endpoint has no password. In the OwnTracks app:

1. **Mode:** HTTP.
2. **URL:** `https://mhacks.org/api/owntracks`.
3. **Username:** the name shown on the map, so use the name hackers know you by
   (40 characters at most). Without one, the endpoint rejects the update.
4. Set location access to **Always** (iOS) so it reports with the phone locked,
   and switch to **Move** mode while on shift.

The username is the only identity. Two phones with the same username show up
as one person.

**Anyone who finds the URL can post a location under any name**, including a
fake organizer on the map hackers use to find help. That was accepted to keep
setup free of AWS changes. To lock it down later, check a shared password in
the route, read from an env var supplied through SSM in `task-definition.json`
like the app's other secrets. To remove a bad entry now, use the `delete` below.

`/api/owntracks` is rate limited per minute: 300 requests per client address,
and 60 per username. A limited phone gets a 429 and keeps the message queued
to retry.

## Stopping and cleanup

There is no stop button. Turning OwnTracks off, or switching it out of HTTP
mode, stops the updates. Hackers stop seeing that person 15 minutes after their
last fix. Organizers see them until it is 3 hours old.

The table holds one row per username: each update replaces that person's
previous position, unless it is older (the app delivers queued fixes late).
Every update, from anyone, also deletes rows older than 3 hours. Once every
phone is off, the last few hours stay in the table. To remove someone right
away, or to clear everything after the event:

```sql
delete from public.organizer_locations where name = 'Their username';
delete from public.organizer_locations; -- everyone
```

## Limits worth knowing

- OwnTracks' default monitoring mode only reports after a significant move
  (hundreds of meters or several minutes). **Move** mode reports often and
  costs battery.
- Indoor GPS is often off by tens of meters and has no floor. The page says so.
- Phones can't reach `localhost`. To test with a real phone locally, use a LAN
  address or an HTTPS tunnel as the URL.
