import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import type { UserEntry } from "@/lib/db/schema/users";

export async function requireOrganizerPage(
  nextPath: string,
): Promise<UserEntry> {
  const user = await getSessionUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (user.role !== "organizer") redirect("/apply");

  return user;
}
