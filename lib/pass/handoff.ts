/*
  Carries one bouquet PNG from the bouquet game to the pass's bouquet slot.

  The bouquet game opens in its own tab so the pass's in-progress edits (name,
  backdrop, stickers, …) survive — see the comment on the "MHacks ticket" link
  in ExportPanel. That means the hand-off can't be a return value or a route
  param; it has to be something both tabs can see. `localStorage` plus the
  `storage` event does exactly that: writing here fires `storage` in every
  *other* same-origin tab, which is what lets an already-open pass tab pick up
  the bouquet the moment the game tab sends it, with no polling and no server.
*/

export const BOUQUET_HANDOFF_STORAGE_KEY = "mh-pass-bouquet-handoff";

export function writeBouquetHandoff(dataUrl: string) {
  try {
    localStorage.setItem(BOUQUET_HANDOFF_STORAGE_KEY, dataUrl);
  } catch {
    // Private browsing / full storage: the "use on pass" action just quietly
    // does nothing rather than throwing in front of the hacker.
  }
}

export function readBouquetHandoff(): string | null {
  try {
    return localStorage.getItem(BOUQUET_HANDOFF_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearBouquetHandoff() {
  try {
    localStorage.removeItem(BOUQUET_HANDOFF_STORAGE_KEY);
  } catch {
    // ignore — nothing to clean up if storage isn't available
  }
}
