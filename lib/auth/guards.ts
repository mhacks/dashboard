import { redirect } from "next/navigation";
import type { UserEntry } from "@/lib/db/schema/users";
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
