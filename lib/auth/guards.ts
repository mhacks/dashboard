import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import type { UserEntry } from "@/lib/db/schema/users";

export type CurrentUserSummary = Pick<UserEntry, "id" | "email" | "role">;

export function toCurrentUserSummary(user: UserEntry): CurrentUserSummary {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

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

export async function requireOrganizerPage(
  nextPath: string,
): Promise<UserEntry> {
  const user = await getSessionUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (user.role !== "organizer") redirect("/apply");

  return user;
}
