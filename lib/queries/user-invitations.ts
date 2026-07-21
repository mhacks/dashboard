import { desc, eq, ilike, sql } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  pendingInviteForEmail,
  userInvitations,
} from "@/lib/db/schema/user-invitations";
import { users, type UserRole } from "@/lib/db/schema/users";
import {
  INVITE_PAGE_SIZE,
  normalizeInviteEmail,
  userInviteEmailSchema,
} from "@/lib/types/user-invitations";

function parseInviteEmail(email: string): string | null {
  const normalizedEmail = normalizeInviteEmail(email);
  if (!userInviteEmailSchema.safeParse(normalizedEmail).success) {
    return null;
  }
  return normalizedEmail;
}

export async function listUserInvites(
  pageIndex = 0,
  pageSize = INVITE_PAGE_SIZE,
  search = "",
) {
  await requireOrganizer();

  const safePageIndex = Math.max(0, pageIndex);
  const safePageSize = Math.min(Math.max(pageSize, 1), 50);
  const trimmedSearch = search.trim().slice(0, 100);
  const filters = trimmedSearch
    ? ilike(userInvitations.email, `%${trimmedSearch}%`)
    : undefined;

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
    .where(filters)
    .orderBy(desc(userInvitations.createdAt))
    .limit(safePageSize)
    .offset(safePageIndex * safePageSize);

  return {
    items: rows.map(
      ({
        id,
        email,
        role,
        acceptedAt,
        revokedAt,
        expiresAt,
        createdAt,
        invitedByEmail,
      }) => ({
        id,
        email,
        role,
        acceptedAt,
        revokedAt,
        expiresAt,
        createdAt,
        invitedByEmail,
      }),
    ),
    totalCount: rows[0]?.totalCount ?? 0,
  };
}

export async function getPendingUserInvite(
  email: string,
): Promise<UserRole | null> {
  const normalizedEmail = parseInviteEmail(email);
  if (!normalizedEmail) return null;

  const [invite] = await db
    .select({ role: userInvitations.role })
    .from(userInvitations)
    .where(pendingInviteForEmail(normalizedEmail))
    .limit(1);

  return invite?.role ?? null;
}

export async function acceptPendingUserInvite(
  userId: string,
  email: string,
): Promise<UserRole | null> {
  const normalizedEmail = parseInviteEmail(email);
  if (!normalizedEmail) return null;

  const [invite] = await db
    .select({
      id: userInvitations.id,
      role: userInvitations.role,
    })
    .from(userInvitations)
    .where(pendingInviteForEmail(normalizedEmail))
    .limit(1);

  if (!invite) {
    return null;
  }

  const acceptedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ role: invite.role })
      .where(eq(users.id, userId));

    await tx
      .update(userInvitations)
      .set({ acceptedAt })
      .where(eq(userInvitations.id, invite.id));
  });

  return invite.role;
}
