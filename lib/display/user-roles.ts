import type { UserRole } from "@/lib/db/schema/users";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  hacker: "Hacker",
  organizer: "Organizer",
  admin: "Admin",
  volunteer: "Volunteer",
  judge: "Judge",
};

export function userRoleLabel(role: UserRole) {
  return USER_ROLE_LABELS[role];
}
