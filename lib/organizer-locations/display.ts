/*
  Presentation rules for find my organizer, kept out of the components so the
  map and the list can't disagree about a person's color or freshness. Safe to
  import from client components: nothing here touches the server.
*/

/** How far back organizers see each person's path. Hackers see no trail. */
export const TRAIL_HOURS = 3;
/** Hackers only see organizers whose last fix is newer than this. */
export const PUBLIC_WINDOW_MINUTES = 15;
export const FRESH_WITHIN_MINUTES = 5;

const MINUTE_MS = 60_000;

/**
 * Categorical slots in fixed order, validated for colorblind separation on the
 * map. Slots 3–5 sit under 3:1 against the basemap, which is why every marker
 * carries a name label and a white ring. Light only: the console pages this
 * renders on have no dark mode.
 */
const PERSON_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

/** Past eight people, color stops carrying identity; the label does it alone. */
const OVERFLOW_COLOR = "#8a8a84";

/**
 * Slots go by a stable ID, not list position, so someone keeps their color
 * when others start or stop sharing between refreshes.
 */
export function personColors(ids: string[]) {
  const colors = new Map<string, string>();
  [...ids].sort().forEach((id, index) => {
    colors.set(id, PERSON_COLORS[index] ?? OVERFLOW_COLOR);
  });
  return colors;
}

export type Freshness = "fresh" | "recent" | "stale";

export function freshness(recordedAt: string, now: number): Freshness {
  const minutes = (now - Date.parse(recordedAt)) / MINUTE_MS;
  if (minutes < FRESH_WITHIN_MINUTES) return "fresh";
  if (minutes < PUBLIC_WINDOW_MINUTES) return "recent";
  return "stale";
}

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  fresh: "Live",
  recent: "Recent",
  stale: "Stale",
};

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function seenAgo(at: string, now: number) {
  const minutes = Math.round((Date.parse(at) - now) / MINUTE_MS);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relativeTime.format(hours, "hour");
  return relativeTime.format(Math.round(hours / 24), "day");
}

export function mapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
