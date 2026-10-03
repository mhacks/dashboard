# Find my organizer

`/find-my-organizer` shows where organizers are on a map. It shows only
phones running the [OwnTracks](https://owntracks.org) app that POST their
location to `/api/owntracks`. Nothing polls Apple or anyone else, and there is
nothing to turn on in the dashboard.

## Who sees what

| Viewer                                 | Sees                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Organizers                             | Everyone who has reported in the last 3 hours, including stale positions, each trail, and battery. |
| Volunteers, judges, checked-in hackers | Name and position of people whose last update is under 15 minutes old. No trail, no battery.       |
| Everyone else                          | A note that the page opens after check-in.                                                         |

The filtering happens on the server, so hackers' browsers never receive trails
or battery levels. The attendee view is cached per server task for 10 seconds,
so a hall full of open pages costs one read per task, not one per hacker.

## Setting up a phone

Every phone uses the same password, `OWNTRACKS_PASSWORD` (SSM parameter
`/mhacks-secrets/OWNTRACKS_PASSWORD` in production). If it is unset, the
endpoint rejects everything. In the OwnTracks app:

1. **Mode:** HTTP.
2. **URL:** `https://mhacks.org/api/owntracks`.
3. **Authentication:** on. **Username** is the name shown on the map, so use
   the name hackers know you by (40 characters at most). **Password** is the
   shared password.
4. Set location access to **Always** (iOS) so it reports with the phone locked,
   and switch to **Move** mode while on shift.

The username is the only identity. Two phones with the same username show up
as one person, and anyone with the password can post under any name, so share
it only with organizers. To lock everyone out, change the password.

## Stopping and cleanup

There is no stop button. Turning OwnTracks off, or switching it out of HTTP
mode, stops the updates. Hackers stop seeing that person 15 minutes after their
last fix. Organizers see them until it is 3 hours old.

Every new fix, from anyone, deletes all fixes older than 3 hours. Once every
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
