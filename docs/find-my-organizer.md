# Find my organizer

`/find-my-organizer` shows where organizers are on a map. Organizers opt in by
running the [OwnTracks](https://owntracks.org) app on their phone, which POSTs
its location to `/api/owntracks`. Nothing polls Apple or anyone else: the page
only reads what phones have sent.

## Who sees what

| Viewer                                 | Sees                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Organizers                             | Everyone sharing, including stale positions, the last 3 hours of each trail, and battery. Plus their own sharing controls. |
| Volunteers, judges, checked-in hackers | Name and position of organizers whose last update is under 15 minutes old. No trail, no battery.                           |
| Everyone else                          | A note that the page opens after check-in.                                                                                 |

The filtering happens on the server, so hackers' browsers never receive trails
or battery levels. The attendee view is cached per server task for 10 seconds,
so a hall full of open pages costs one read per task, not one per hacker.

## Sharing

An organizer turns on sharing on the page and picks the name hackers see. They
get a QR code and an **Open in OwnTracks** link that configures the app (HTTP
mode, this site's endpoint, and a personal password), plus the same settings to
enter by hand. The password is shown once; only its SHA-256 is stored. Making a
new link replaces it.

**Stop sharing** revokes the password and deletes every point that organizer
sent. Losing the organizer role also stops their password working and hides
them from the map.

Each organizer's history is trimmed to 3 hours as new points arrive, always
keeping their newest point. Delete any remaining rows after the event:

```sql
delete from public.organizer_location_sharing; -- cascades to organizer_locations
```

## Limits worth knowing

- OwnTracks' default monitoring mode only reports after a significant move
  (hundreds of meters or several minutes). Organizers on shift should switch to
  **Move** mode, which reports often and costs battery.
- Indoor GPS is often off by tens of meters and has no floor. The page says so.
- iOS needs location access set to **Always** to report with the phone locked.
- Phones can't reach `localhost`. To test with a real phone locally, open the
  dashboard through a LAN address or an HTTPS tunnel before making the setup
  link, since the link embeds the address the page was opened on. In
  production it always uses `https://mhacks.org`.
