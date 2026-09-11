import { desc, eq, sql, type SQL } from "drizzle-orm";

import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { hackerRsvpExceptions } from "@/lib/db/schema/rsvps";
import { users } from "@/lib/db/schema/users";
import {
  rsvpExceptionStatus,
  type AdminRsvpException,
} from "@/lib/types/rsvp-exceptions";

const createdByEmailSql = sql<string | null>`(
  select creator.email
  from public.users creator
  where creator.id = ${hackerRsvpExceptions.createdByUserId}
  limit 1
)`;

function applicationNameSql() {
  return sql<string>`trim(${hackerApplicants.firstName} || ' ' || ${hackerApplicants.lastName})`;
}

type AdminRsvpExceptionRow = {
  id: string;
  userId: string;
  applicationId: string;
  applicationName: string;
  accountEmail: string | null;
  applicationDecision: AdminRsvpException["applicationDecision"];
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  createdByEmail: string | null;
};

export function adminRsvpExceptionFromRow(
  row: AdminRsvpExceptionRow,
): AdminRsvpException {
  const exception = {
    ...row,
    accountEmail: row.accountEmail ?? "",
    status: "active",
  } satisfies AdminRsvpException;

  return {
    ...exception,
    status: rsvpExceptionStatus(exception),
  };
}

export async function getAdminRsvpExceptions(): Promise<AdminRsvpException[]> {
  await requireOrganizer();
  return getAdminRsvpExceptionRows();
}

export async function getAdminRsvpExceptionById(
  id: string,
): Promise<AdminRsvpException | null> {
  await requireOrganizer();
  const rows = await getAdminRsvpExceptionRows(eq(hackerRsvpExceptions.id, id));
  return rows[0] ?? null;
}

async function getAdminRsvpExceptionRows(where?: SQL) {
  const query = db
    .select({
      id: hackerRsvpExceptions.id,
      userId: hackerRsvpExceptions.userId,
      applicationId: hackerApplicants.id,
      applicationName: applicationNameSql(),
      accountEmail: users.email,
      applicationDecision: hackerApplicants.decision,
      expiresAt: hackerRsvpExceptions.expiresAt,
      revokedAt: hackerRsvpExceptions.revokedAt,
      createdAt: hackerRsvpExceptions.createdAt,
      updatedAt: hackerRsvpExceptions.updatedAt,
      note: hackerRsvpExceptions.note,
      createdByEmail: createdByEmailSql,
    })
    .from(hackerRsvpExceptions)
    .innerJoin(users, eq(users.id, hackerRsvpExceptions.userId))
    .innerJoin(
      hackerApplicants,
      eq(hackerApplicants.userId, hackerRsvpExceptions.userId),
    );

  const rows = await (where ? query.where(where) : query).orderBy(
    desc(hackerRsvpExceptions.createdAt),
  );

  return rows.map(adminRsvpExceptionFromRow);
}
