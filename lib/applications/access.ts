import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { hackerApplicationInvitations } from "@/lib/db/schema/application-invitations";
import { users } from "@/lib/db/schema/users";
import {
  APPLICATION_CLOSE_MS,
  isApplicationOpen,
} from "@/lib/applications/deadline";

export type ApplicationAccess = {
  open: boolean;
  closesAt: string | null;
  source: "global" | "invitation" | null;
};

export async function getApplicationAccessForUser({
  userId,
  nowMs = Date.now(),
}: {
  userId: string;
  nowMs?: number;
}): Promise<ApplicationAccess> {
  const now = new Date(nowMs);
  const [invitation] = await db
    .select({ expiresAt: hackerApplicationInvitations.expiresAt })
    .from(hackerApplicationInvitations)
    .innerJoin(
      users,
      and(
        eq(users.id, userId),
        eq(users.role, "hacker"),
        sql`lower(${users.email}) = ${hackerApplicationInvitations.email}`,
      ),
    )
    .where(
      and(
        isNull(hackerApplicationInvitations.revokedAt),
        gt(hackerApplicationInvitations.expiresAt, now.toISOString()),
      ),
    )
    .orderBy(desc(hackerApplicationInvitations.expiresAt))
    .limit(1);

  const globalClosesAtMs = isApplicationOpen(nowMs)
    ? APPLICATION_CLOSE_MS
    : null;
  const invitationClosesAtMs = invitation
    ? Date.parse(invitation.expiresAt)
    : null;
  const closesAtMs = Math.max(
    globalClosesAtMs ?? Number.NEGATIVE_INFINITY,
    invitationClosesAtMs ?? Number.NEGATIVE_INFINITY,
  );

  if (!Number.isFinite(closesAtMs)) {
    return { open: false, closesAt: null, source: null };
  }

  return {
    open: true,
    closesAt: new Date(closesAtMs).toISOString(),
    source: closesAtMs === invitationClosesAtMs ? "invitation" : "global",
  };
}

export async function assertApplicationOpenForUser(
  userId: string,
  nowMs = Date.now(),
): Promise<ApplicationAccess> {
  const access = await getApplicationAccessForUser({ userId, nowMs });
  if (!access.open) throw new Error("Applications are closed");
  return access;
}
