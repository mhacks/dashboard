/*
  The OwnTracks side of find my organizer: who sent a message and what fix it
  carries. Field names follow https://owntracks.org/booklet/tech/json/.
*/

/** Path the app POSTs to. Public in proxy.ts, with no password. */
export const OWNTRACKS_PATH = "/api/owntracks";

/** Fixes stamped this far in the future are a broken phone clock, not data. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const MAX_ACCURACY_M = 100_000;
export const MAX_NAME_LENGTH = 40;

function basicAuthUsername(header: string | null) {
  const match = header?.match(/^Basic\s+(\S+)$/i);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  return separator < 0 ? decoded : decoded.slice(0, separator);
}

/**
 * The name to show on the map: the username set in the app. It arrives in
 * the Basic-auth header when authentication is on, and in `X-Limit-U` either
 * way. Trimmed with whitespace collapsed; null if missing or too long.
 */
export function owntracksName(headers: Headers): string | null {
  const raw =
    basicAuthUsername(headers.get("authorization"))?.trim() ||
    headers.get("x-limit-u");
  const name = raw?.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_NAME_LENGTH) return null;
  return name;
}

export type OwntracksFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  battery: number | null;
  recordedAt: string;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * The fix in a `_type: "location"` message, or null for anything else. The
 * app also sends transitions, waypoints and status messages; those are
 * acknowledged and dropped.
 */
export function parseOwntracksLocation(
  payload: unknown,
  now = Date.now(),
): OwntracksFix | null {
  if (typeof payload !== "object" || payload === null) return null;
  const message = payload as Record<string, unknown>;
  if (message._type !== "location") return null;

  const { lat, lon, tst, acc, batt } = message;
  if (!finite(lat) || lat < -90 || lat > 90) return null;
  if (!finite(lon) || lon < -180 || lon > 180) return null;
  if (!finite(tst) || tst <= 0) return null;

  const recordedMs = Math.round(tst) * 1000;
  if (recordedMs > now + MAX_CLOCK_SKEW_MS) return null;

  return {
    latitude: lat,
    longitude: lon,
    accuracy:
      finite(acc) && acc >= 0 && acc <= MAX_ACCURACY_M ? Math.round(acc) : null,
    battery: finite(batt) && batt >= 0 && batt <= 100 ? Math.round(batt) : null,
    recordedAt: new Date(recordedMs).toISOString(),
  };
}
