/*
  Carries one bouquet PNG, and the name its designer gave it, from the bouquet
  game to the pass's bouquet slot.

  The bouquet game opens in its own tab so the pass's in-progress edits (name,
  backdrop, stickers, …) survive — see the comment on the "MHacks ticket" link
  in ExportPanel. That means the hand-off can't be a return value or a route
  param; it has to be something both tabs can see. `localStorage` plus the
  `storage` event does exactly that: writing here fires `storage` in every
  *other* same-origin tab, which is what lets an already-open pass tab pick up
  the bouquet the moment the game tab sends it, with no polling and no server.
*/

import { BOUQUET_NAME_MAX } from "@/lib/pass/limits";

export const BOUQUET_HANDOFF_STORAGE_KEY = "mh-pass-bouquet-handoff";

/** What one "use on pass" sends over. */
export type BouquetHandoff = {
  /** Sanitised, possibly empty — an unnamed design falls back to "Design n". */
  name: string;
  /** The sticker PNG, as a data URL. */
  dataUrl: string;
};

/**
 * One line, no runs of whitespace, never over the cap. Applied on the way out
 * *and* on the way in: the payload sits in localStorage between the two tabs,
 * where anything could have edited it, so the pass never trusts what it reads
 * to already be within its own limits.
 */
export function sanitizeBouquetName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, BOUQUET_NAME_MAX);
}

/**
 * Reads one hand-off out of its stored form, or null if it isn't one.
 *
 * Exported for the `storage` listener, which is handed the new value directly
 * and so never re-reads it. Tolerates a bare data URL: that's what versions
 * before names wrote, and one can still be sitting in storage from a game tab
 * opened before a deploy.
 */
export function parseBouquetHandoff(raw: string): BouquetHandoff | null {
  let name = "";
  let dataUrl = raw;

  if (raw.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const record = parsed as Partial<BouquetHandoff> | null;
      if (!record || typeof record.dataUrl !== "string") return null;
      dataUrl = record.dataUrl;
      name =
        typeof record.name === "string" ? sanitizeBouquetName(record.name) : "";
    } catch {
      return null;
    }
  }

  // The pass renders this straight into an <img> — only ever an image.
  return dataUrl.startsWith("data:image/") ? { name, dataUrl } : null;
}

export function writeBouquetHandoff(dataUrl: string, name: string) {
  try {
    localStorage.setItem(
      BOUQUET_HANDOFF_STORAGE_KEY,
      JSON.stringify({ name: sanitizeBouquetName(name), dataUrl }),
    );
  } catch {
    // Private browsing / full storage: the "use on pass" action just quietly
    // does nothing rather than throwing in front of the hacker.
  }
}

export function readBouquetHandoff(): BouquetHandoff | null {
  try {
    const raw = localStorage.getItem(BOUQUET_HANDOFF_STORAGE_KEY);
    return raw ? parseBouquetHandoff(raw) : null;
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
