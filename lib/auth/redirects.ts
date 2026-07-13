import type { UserRole } from "@/lib/db/schema/users";

export function sanitizeNextPath(next?: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("/login")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export function destinationForRole(role: UserRole, next?: string | null) {
  const safeNext = sanitizeNextPath(next);

  if (role === "hacker") {
    return safeNext?.startsWith("/admin") ? "/apply" : (safeNext ?? "/apply");
  }

  return safeNext ?? "/admin/applications";
}
