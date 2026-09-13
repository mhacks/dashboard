// The public countdown ends at 11:59:59.999 PM Eastern. Writes remain open
// for a short grace period, then every web and MCP mutation uses the effective
// close timestamp below as its authoritative cutoff.
export const APPLICATION_DEADLINE_ISO = "2026-09-12T23:59:59.999-04:00";
export const APPLICATION_GRACE_PERIOD_MS = 30 * 60 * 1000;
export const APPLICATION_CLOSE_MS =
  Date.parse(APPLICATION_DEADLINE_ISO) + APPLICATION_GRACE_PERIOD_MS;
export const APPLICATION_CLOSE_ISO = new Date(
  APPLICATION_CLOSE_MS,
).toISOString();

export function isApplicationOpen(nowMs = Date.now()): boolean {
  return nowMs <= APPLICATION_CLOSE_MS;
}

export function assertApplicationOpen(nowMs = Date.now()): void {
  if (!isApplicationOpen(nowMs)) {
    throw new Error("Applications are closed");
  }
}
