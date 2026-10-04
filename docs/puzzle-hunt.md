# Puzzle hunt

The hunt starts on `/find-my-organizer`. A checked-in hacker finds an
organizer on the map and asks for a code; the code unlocks the first puzzle at
`/find-my-organizer/puzzle`. Later stages run through the Discord bot
(`/unlock`, in `mhacks-discord-bot`).

## Codes

Organizers make codes at **`/admin/hunt-codes`** (also linked from the map
page and the organizer dashboard). Any organizer can make one at any time.

- Six digits, valid for 5 minutes, and **single use**: a code passed to a
  friend works for only one of them.
- Making a new code doesn't cancel an earlier unused one, so an organizer can
  hand codes to a line of hackers.
- The page shows each code's status (waiting, used, expired) and updates by
  itself while a code is waiting.

Hackers type the code into **Found one?** on the map page. Only checked-in
hackers can enter codes; volunteers and judges can't. Each hacker gets 10
tries per 10 minutes, right or wrong, which is plenty for typos and useless
for guessing a million possible codes. A hacker who has unlocked the puzzle
sees **Go to the puzzle** instead and never needs another code.

Codes are stored as typed in `hunt_codes`: with a million possible values a
hash would be reversed instantly, so the rate limit and the 5-minute expiry
are what protect them. `hunt_progress` holds one row per hacker who unlocked
the puzzle.

## Resetting

```sql
delete from public.hunt_progress where user_id = '…'; -- one hacker starts over
delete from public.hunt_progress; delete from public.hunt_codes; -- everyone
```
