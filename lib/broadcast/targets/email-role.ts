import { and, count, eq, sql } from "drizzle-orm";
import {
  deliverBroadcastEmail,
  renderBroadcastEmail,
} from "@/lib/broadcast/targets/email-shared";
import type { BroadcastTarget } from "@/lib/broadcast/types";
import { USER_ROLE_LABELS } from "@/lib/display/user-roles";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { eventCheckins } from "@/lib/db/schema/events";
import { users } from "@/lib/db/schema/users";
import {
  INVITABLE_USER_ROLES,
  type InvitableUserRole,
} from "@/lib/types/user-invitations";

const nonEmptyEmailFilter = sql`length(btrim(${users.email})) > 0`;
const hackerApplicantJoin = eq(hackerApplicants.userId, users.id);
const hackerCheckinJoin = eq(eventCheckins.userId, users.id);

function createStaffRoleEmailTarget(
  role: Exclude<InvitableUserRole, "hacker">,
): BroadcastTarget {
  const recipientFilter = and(eq(users.role, role), nonEmptyEmailFilter);

  return {
    id: `email:${role}`,
    label: `${USER_ROLE_LABELS[role]} Emails`,
    countRecipients: async () => {
      const [{ value }] = await db
        .select({ value: count() })
        .from(users)
        .where(recipientFilter);

      return value;
    },
    resolveRecipients: async () => {
      const emailRows = await db
        .select({ email: users.email })
        .from(users)
        .where(recipientFilter);

      return emailRows.map((row) => row.email.trim().toLowerCase());
    },
    renderMessage: renderBroadcastEmail,
    deliver: deliverBroadcastEmail,
  };
}

function createHackerEmailTarget(): BroadcastTarget {
  const recipientFilter = and(eq(users.role, "hacker"), nonEmptyEmailFilter);

  return {
    id: "email:hacker",
    label: `${USER_ROLE_LABELS.hacker} Emails`,
    countRecipients: async () => {
      const [{ value }] = await db
        .select({
          value: sql<number>`count(distinct ${users.id})`,
        })
        .from(users)
        .innerJoin(hackerApplicants, hackerApplicantJoin)
        .innerJoin(eventCheckins, hackerCheckinJoin)
        .where(recipientFilter);

      return value;
    },
    resolveRecipients: async () => {
      const emailRows = await db
        .selectDistinct({ email: users.email })
        .from(users)
        .innerJoin(hackerApplicants, hackerApplicantJoin)
        .innerJoin(eventCheckins, hackerCheckinJoin)
        .where(recipientFilter);

      return emailRows.map((row) => row.email.trim().toLowerCase());
    },
    renderMessage: renderBroadcastEmail,
    deliver: deliverBroadcastEmail,
  };
}

const staffBroadcastRoles = INVITABLE_USER_ROLES.filter(
  (role): role is Exclude<InvitableUserRole, "hacker"> => role !== "hacker",
);

export const roleEmailTargets: BroadcastTarget[] = [
  createHackerEmailTarget(),
  ...staffBroadcastRoles.map(createStaffRoleEmailTarget),
];
