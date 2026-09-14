import { desc, eq, sql, type SQL } from "drizzle-orm";

import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicationInvitations } from "@/lib/db/schema/application-invitations";
import { users } from "@/lib/db/schema/users";
import {
  applicationInvitationStatus,
  type AdminApplicationInvitation,
} from "@/lib/types/application-invitations";

const applicationIdSql = sql<string | null>`(
  select applicant.id
  from public.hacker_applicants applicant
  inner join public.users target_user on target_user.id = applicant.user_id
  where lower(target_user.email) = ${hackerApplicationInvitations.email}
  limit 1
)`;

const applicationNameSql = sql<string | null>`(
  select trim(applicant.first_name || ' ' || applicant.last_name)
  from public.hacker_applicants applicant
  inner join public.users target_user on target_user.id = applicant.user_id
  where lower(target_user.email) = ${hackerApplicationInvitations.email}
  limit 1
)`;

const submittedAtSql = sql<string | null>`(
  select applicant.created_at
  from public.hacker_applicants applicant
  inner join public.users target_user on target_user.id = applicant.user_id
  where lower(target_user.email) = ${hackerApplicationInvitations.email}
  limit 1
)`;

type AdminApplicationInvitationRow = Omit<AdminApplicationInvitation, "status">;

function invitationFromRow(
  row: AdminApplicationInvitationRow,
): AdminApplicationInvitation {
  return {
    ...row,
    status: applicationInvitationStatus(row),
  };
}

export async function getAdminApplicationInvitations(): Promise<
  AdminApplicationInvitation[]
> {
  await requireOrganizer();
  return getAdminApplicationInvitationRows();
}

export async function getAdminApplicationInvitationById(
  id: string,
): Promise<AdminApplicationInvitation | null> {
  await requireOrganizer();
  const rows = await getAdminApplicationInvitationRows(
    eq(hackerApplicationInvitations.id, id),
  );
  return rows[0] ?? null;
}

async function getAdminApplicationInvitationRows(where?: SQL) {
  const query = db
    .select({
      id: hackerApplicationInvitations.id,
      email: hackerApplicationInvitations.email,
      expiresAt: hackerApplicationInvitations.expiresAt,
      revokedAt: hackerApplicationInvitations.revokedAt,
      createdAt: hackerApplicationInvitations.createdAt,
      updatedAt: hackerApplicationInvitations.updatedAt,
      note: hackerApplicationInvitations.note,
      createdByEmail: users.email,
      applicationId: applicationIdSql,
      applicationName: applicationNameSql,
      submittedAt: submittedAtSql,
    })
    .from(hackerApplicationInvitations)
    .innerJoin(
      users,
      eq(users.id, hackerApplicationInvitations.invitedByUserId),
    );

  const rows = await (where ? query.where(where) : query).orderBy(
    desc(hackerApplicationInvitations.createdAt),
  );
  return rows.map(invitationFromRow);
}
