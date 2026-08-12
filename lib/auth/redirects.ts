import type { UserRole } from "@/lib/db/schema/users";

export function sanitizeNextPath(next?: string | null) {
  if (!next) return null;
  if (next.includes("\\") || next.includes("\n") || next.includes("\r"))
    return null;
  if (
    !next.startsWith("/") ||
    next.startsWith("/login") ||
    next.startsWith("//")
  )
    return null;
  return next;
}

/**
 * Where to land after signing in. Every role goes to /dashboard — it serves
 * hackers and organizers alike, surfacing admin entry points for the latter.
 *
 * The role is still needed to catch one case: a non-organizer carrying
 * `?next=/admin` would be bounced straight back out by the middleware, so send
 * them to the dashboard instead of through a redirect they cannot survive.
 */
export function destinationForRole(role: UserRole, next?: string | null) {
  const safeNext = sanitizeNextPath(next);

  if (role !== "organizer" && safeNext?.startsWith("/admin"))
    return "/dashboard";

  return safeNext ?? "/dashboard";
}
