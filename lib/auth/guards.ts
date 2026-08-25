import { redirect } from "next/navigation";
import type { UserEntry, UserRole } from "@/lib/db/schema/users";
import { getSessionUser } from "@/lib/auth/session";

export async function requireSessionUser(): Promise<UserEntry> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireOrganizer(): Promise<UserEntry> {
  const user = await requireSessionUser();
  if (user.role !== "organizer") throw new Error("Forbidden");
  return user;
}

export async function requireOrganizerPage(): Promise<UserEntry> {
  const user = await requireSessionUser();
  // Back to the dashboard, which is where every role belongs — it just won't
  // show them the admin tiles.
  if (user.role !== "organizer") redirect("/dashboard");
  return user;
}

/**
 * Who may run a check-in scanner. Wider than organizer on purpose: volunteers
 * work the door and the meal lines, and promoting each of them to organizer
 * just to let them scan would hand out the entire admin portal with it.
 *
 * Scanning is all this grants. Creating events, reading a roster and reverting
 * a mis-scan stay on `requireOrganizer`.
 *
 * `admin` is deliberately excluded, matching `requireOrganizer` above: the
 * value exists in the enum but nothing in this app grants it anything today,
 * and quietly making it meaningful here would be a surprise. Mirrored by the
 * `isEventStaff` RLS predicate in lib/db/schema/rls.ts.
 */
export function isEventStaff(role: UserRole) {
  return role === "organizer" || role === "volunteer";
}

export async function requireEventStaff(): Promise<UserEntry> {
  const user = await requireSessionUser();
  if (!isEventStaff(user.role)) throw new Error("Forbidden");
  return user;
}

export async function requireEventStaffPage(): Promise<UserEntry> {
  const user = await requireSessionUser();
  if (!isEventStaff(user.role)) redirect("/dashboard");
  return user;
}
