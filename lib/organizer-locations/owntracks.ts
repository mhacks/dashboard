import { createHash, randomBytes } from "node:crypto";

/*
  The OwnTracks side of find my organizer: the per-organizer password, the
  app's config link, and parsing what the app POSTs.
  Field names follow https://owntracks.org/booklet/tech/json/.
*/

/** Path the app POSTs to. Public in proxy.ts; the route checks the password. */
export const OWNTRACKS_PATH = "/api/owntracks";

/** Fixes stamped this far in the future are a broken phone clock, not data. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const MAX_ACCURACY_M = 100_000;

export function newSharingToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSharingToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** The password from an `Authorization: Basic` header. OwnTracks' username is ignored. */
export function basicAuthPassword(header: string | null): string | null {
  const match = header?.match(/^Basic\s+(\S+)$/i);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  return decoded.slice(separator + 1) || null;
}

/** Two-letter tracker ID the app shows on its own map. */
function trackerId(displayName: string) {
  // Letters and digits only: "Alex (Logistics)" is AL, not A(.
  const initials = displayName
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, "")[0])
    .filter(Boolean)
    .join("");
  return (initials || "MH").slice(0, 2).toUpperCase();
}

/**
 * A link that configures the iOS or Android app in one tap: HTTP mode
 * (mode 3), our endpoint, and this organizer's password. Significant-change
 * monitoring (1) is the battery-friendly default; organizers can switch to
 * Move in the app while on shift.
 */
export function owntracksConfigLink({
  origin,
  username,
  token,
  displayName,
}: {
  origin: string;
  username: string;
  token: string;
  displayName: string;
}) {
  const config = {
    _type: "configuration",
    mode: 3,
    url: `${origin}${OWNTRACKS_PATH}`,
    auth: true,
    username,
    password: token,
    tid: trackerId(displayName),
    monitoring: 1,
  };
  const inline = Buffer.from(JSON.stringify(config)).toString("base64");
  return `owntracks:///config?inline=${encodeURIComponent(inline)}`;
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
