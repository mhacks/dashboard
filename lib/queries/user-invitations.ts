import { desc, eq, sql } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  pendingInviteForEmail,
  userInvitations,
} from "@/lib/db/schema/user-invitations";
import { users, type UserRole } from "@/lib/db/schema/users";
import {
  normalizeInviteEmail,
  userInviteEmailSchema,
} from "@/lib/types/user-invitations";

export const INVITE_PAGE_SIZE = 10;

export async function listUserInvites(
  pageIndex = 0,
  pageSize = INVITE_PAGE_SIZE,
) {
  await requireOrganizer();

  const safePageIndex = Math.max(0, pageIndex);
  const safePageSize = Math.min(Math.max(pageSize, 1), 50);

  const rows = await db
    .select({
      id: userInvitations.id,
      email: userInvitations.email,
      role: userInvitations.role,
      acceptedAt: userInvitations.acceptedAt,
      revokedAt: userInvitations.revokedAt,
      expiresAt: userInvitations.expiresAt,
      createdAt: userInvitations.createdAt,
      invitedByEmail: users.email,
      totalCount: sql<number>`count(*) over()::int`,
    })
    .from(userInvitations)
    .innerJoin(users, eq(userInvitations.invitedBy, users.id))
    .orderBy(desc(userInvitations.createdAt))
    .limit(safePageSize)
    .offset(safePageIndex * safePageSize);

  return {
    items: rows.map(({ totalCount: _totalCount, ...item }) => item),
    totalCount: rows[0]?.totalCount ?? 0,
  };
}

export async function getPendingUserInvite(
  email: string,
): Promise<UserRole | null> {
  const normalizedEmail = normalizeInviteEmail(email);
  if (!userInviteEmailSchema.safeParse(normalizedEmail).success) {
    return null;
  }

  const [invite] = await db
    .select({ role: userInvitations.role })
    .from(userInvitations)
    .where(pendingInviteForEmail(normalizedEmail))
    .limit(1);

  return invite?.role ?? null;
}
