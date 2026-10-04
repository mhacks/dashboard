# Puzzle hunt

1. **Marigold's Garden** (`/scavenger-hunt`, public, linked from `/live` as
   **Scavenger Hunt**): a backstory, an animated garden GIF that hides the key,
   and a Vigenère ciphertext. It decrypts to a paragraph ending in
   `www.mhacks.org/find-my-organizer`.
2. **Find an organizer** (`/find-my-organizer`, checked-in hackers): find an
   organizer on the map and ask for a code; entering it unlocks the puzzle.
3. **The invisible-text puzzle** (`/find-my-organizer/puzzle`): a riddle for
   the hacker's flower hidden in white text.
4. **The petal** (`/`, the main page): clicking a petal of their flower shows
   their final code.

## Marigold's Garden

The key is in the GIF, which is served unoptimized: re-encoding it could
destroy what hides the key. Only the ciphertext lives in the repo, since it
is public. To change the text, encrypt a new plaintext with
`node scripts/vigenere.mjs <key> < plaintext.txt` and paste the output into
`SCAVENGER_CIPHERTEXT` in `app/scavenger-hunt/page.tsx`; keep the key and
plaintext out of the repo. The script shifts only letters, the way online
solvers like dCode and CyberChef do, so punctuation and the URL's separators
survive. `/find-my-organizers` redirects to `/find-my-organizer`, because an
earlier ciphertext decrypted to the plural.

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

## The invisible-text puzzle

`/find-my-organizer/puzzle` looks blank apart from "Hmmm, blank page?". Under
it is a wall of Latin in white on white. Highlighting it (the site's
`::selection` is light text on moss) shows one English passage: the riddle for
the hacker's flower.

- **Each hacker is assigned a flower**: one of the five on the main page
  (`lib/hunt/flowers.ts`), picked at random when they redeem an organizer's
  code and stored in `hunt_progress.flower`. It is random rather than derived
  from their user ID because this repo is public: a formula would let a hacker
  work out their flower without the puzzle. The riddles are drafts; edit them
  in that file.
- **The wall is seeded per hacker** (`lib/hunt/puzzle-text.ts`): a reload shows
  the same text, while two hackers find the passage in different places. It is
  never the first sentence on the page.

## The petal

The riddle sends the hacker back to the main page to click a petal of their
flower. The flower images there carry `data-hunt-flower="<id>"`, and
`components/landing/HuntPetals.tsx` listens for clicks on the page: if one
lands on a petal of a tagged image, it asks the server (`pickPetal`) whether
that is the hacker's flower. If it is, a toast shows their final code, e.g.
`GM4Y-4W09`, and stays until they close it.

- **Petal, not stem or leaf**, is decided by colour: solid, not green, and not
  the dark centre of a black-eyed Susan. The garlands sway with a slight
  rotation, so a click counts if there is petal within 21px of it; a click on
  the stem right beside a petal counts too. A flower covered by the next
  section, or clipped off its edge, doesn't count.
- **A wrong flower locks petals for 5 minutes** and says so (`petal_misses`,
  `petal_locked_until`); clicks during the lock just say to wait. Clicking
  through all five flowers therefore costs up to 20 minutes. Once a hacker has
  their code, other flowers do nothing.
- **Visitors not in the hunt see nothing**: logged out, not checked in, or
  puzzle not unlocked.
- **The code is random**, made on the first right click and stored in
  `hunt_progress.petal_code` with `petal_found_at`; clicking again shows the
  same one. Look a hacker's code up there to check it.
- The garlands stay `pointer-events-none`, so nothing beneath them stops
  working.

## Resetting

```sql
delete from public.hunt_progress where user_id = '…'; -- one hacker starts over
update public.hunt_progress set petal_code = null, petal_found_at = null, petal_misses = 0, petal_locked_until = null where user_id = '…'; -- redo just the petal
delete from public.hunt_progress; delete from public.hunt_codes; -- everyone
```
