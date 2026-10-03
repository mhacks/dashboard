import { createHash, timingSafeEqual } from "node:crypto";

/*
  The OwnTracks side of find my organizer: checking the shared password and
  parsing what the app POSTs. Field names follow
  https://owntracks.org/booklet/tech/json/.
*/

/** Path the app POSTs to. Public in proxy.ts; the route checks the password. */
export const OWNTRACKS_PATH = "/api/owntracks";

/** Fixes stamped this far in the future are a broken phone clock, not data. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const MAX_ACCURACY_M = 100_000;
export const MAX_NAME_LENGTH = 40;

/**
 * The username and password from an `Authorization: Basic` header. The
 * username is the name shown on the map, so it is trimmed and its whitespace
 * collapsed; null if either part is missing or the name is too long.
 */
export function basicAuthCredentials(
  header: string | null,
): { name: string; password: string } | null {
  const match = header?.match(/^Basic\s+(\S+)$/i);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  const name = decoded.slice(0, separator).trim().replace(/\s+/g, " ");
  const password = decoded.slice(separator + 1);
  if (!name || name.length > MAX_NAME_LENGTH || !password) return null;
  return { name, password };
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Whether `password` is OWNTRACKS_PASSWORD. Unset means nobody can post, so a
 * missing env var fails closed rather than opening the map to anyone.
 */
export function isOwntracksPassword(password: string) {
  const expected = process.env.OWNTRACKS_PASSWORD;
  if (!expected) return false;
  // Hashing first gives equal lengths, which timingSafeEqual requires.
  return timingSafeEqual(digest(password), digest(expected));
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
