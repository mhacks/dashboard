import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
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

function inviteSearchCondition(search: string) {
  const term = `%${search.trim()}%`;
  return or(ilike(userInvitations.email, term), ilike(users.email, term));
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
    ? inviteSearchCondition(trimmedSearch)
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
    items: rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      invitedByEmail: row.invitedByEmail,
    })),
    totalCount: rows[0]?.totalCount ?? 0,
  };
}

export async function acceptPendingUserInvite(
  userId: string,
  email: string,
): Promise<UserRole | null> {
  const normalizedEmail = normalizeInviteEmail(email);
  if (!userInviteEmailSchema.safeParse(normalizedEmail).success) {
    return null;
  }

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        sql`lower(${users.email}) = ${normalizedEmail}`,
      ),
    )
    .limit(1);

  if (!user) {
    return null;
  }

  const [invite] = await db
    .select({
      id: userInvitations.id,
      role: userInvitations.role,
    })
    .from(userInvitations)
    .where(pendingInviteForEmail(normalizedEmail))
    .orderBy(desc(userInvitations.createdAt))
    .limit(1);

  if (!invite) {
    return null;
  }

  const acceptedAt = new Date();
  const shouldApplyRole = user.role === "hacker" && user.role !== invite.role;

  await db.transaction(async (tx) => {
    if (shouldApplyRole) {
      const [updatedUser] = await tx
        .update(users)
        .set({ role: invite.role })
        .where(
          and(
            eq(users.id, userId),
            sql`lower(${users.email}) = ${normalizedEmail}`,
          ),
        )
        .returning({ id: users.id });

      if (!updatedUser) {
        throw new Error("Unable to apply invite role for user.");
      }
    }

    const [acceptedInvite] = await tx
      .update(userInvitations)
      .set({ acceptedAt })
      .where(eq(userInvitations.id, invite.id))
      .returning({ id: userInvitations.id });

    if (!acceptedInvite) {
      throw new Error("Unable to accept invite.");
    }
  });

  return shouldApplyRole ? invite.role : user.role;
}
