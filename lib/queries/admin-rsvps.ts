import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { ApplicationDecision } from "@/lib/decisions";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { hackerRsvpDrafts, hackerRsvps } from "@/lib/db/schema/rsvps";
import { users } from "@/lib/db/schema/users";
import type { RsvpReceiptDownloadRecord } from "@/lib/rsvp/download";
import type { AdminRsvpExportRow } from "@/lib/rsvp/export";
import { isRsvpReceiptContentType } from "@/lib/rsvp/receipt";
import { deriveRsvpStatus } from "@/lib/rsvp/status";
import { rsvpRowToFormData } from "@/lib/queries/rsvp";
import { applicationSlugSchema } from "@/lib/types/application-reviews";
import type {
  AdminRsvpDashboard,
  AdminRsvpDetail,
  AdminRsvpSummary,
} from "@/lib/types/admin-rsvps";

const RSVP_ELIGIBLE_DECISIONS = [
  "early_accepted",
  "early_rsvped",
  "regular_accepted",
  "regular_rsvped",
] as const satisfies readonly ApplicationDecision[];

const applicationSlugSql = sql<string>`'app_' || substring(md5(${hackerApplicants.userId}::text) from 1 for 24)`;

const selection = {
  application: hackerApplicants,
  applicationSlug: applicationSlugSql,
  accountEmail: users.email,
  draftUserId: hackerRsvpDrafts.userId,
  final: hackerRsvps,
};

async function selectAdminRsvpRows() {
  return db
    .select(selection)
    .from(hackerApplicants)
    .leftJoin(users, eq(users.id, hackerApplicants.userId))
    .leftJoin(
      hackerRsvpDrafts,
      eq(hackerRsvpDrafts.userId, hackerApplicants.userId),
    )
    .leftJoin(hackerRsvps, eq(hackerRsvps.applicationId, hackerApplicants.id))
    .where(inArray(hackerApplicants.decision, RSVP_ELIGIBLE_DECISIONS))
    .orderBy(asc(hackerApplicants.firstName), asc(hackerApplicants.lastName));
}

type AdminRsvpJoinedRow = Awaited<
  ReturnType<typeof selectAdminRsvpRows>
>[number];

function rowToSummary(row: AdminRsvpJoinedRow): AdminRsvpSummary {
  const values = row.final
    ? rsvpRowToFormData(row.final, row.application, row.accountEmail ?? "")
    : null;
  return {
    applicationId: row.application.id,
    applicationSlug: row.applicationSlug,
    applicationName:
      `${row.application.firstName} ${row.application.lastName}`.trim(),
    accountEmail: row.accountEmail ?? "",
    status: deriveRsvpStatus({
      hasFinal: Boolean(row.final),
      hasDraft: Boolean(row.draftUserId),
    }),
    submittedAt: row.final?.submittedAt ?? null,
    travelPlan: values?.travelPlan ?? null,
    tshirtSize: values?.tshirtSize ?? null,
  };
}

export async function getAdminRsvpDashboard(): Promise<AdminRsvpDashboard> {
  await requireOrganizer();
  const rows = await selectAdminRsvpRows();
  const summaries = rows.map(rowToSummary);
  const counts = summaries.reduce<AdminRsvpDashboard["counts"]>(
    (result, row) => {
      result.all += 1;
      result[row.status] += 1;
      return result;
    },
    { all: 0, not_started: 0, in_progress: 0, submitted: 0 },
  );
  return { rows: summaries, counts };
}

export async function getAdminRsvpDetail(
  slug: string,
): Promise<AdminRsvpDetail | null> {
  await requireOrganizer();
  const parsed = applicationSlugSchema.safeParse(slug);
  if (!parsed.success) return null;

  const [row] = await db
    .select(selection)
    .from(hackerApplicants)
    .leftJoin(users, eq(users.id, hackerApplicants.userId))
    .leftJoin(
      hackerRsvpDrafts,
      eq(hackerRsvpDrafts.userId, hackerApplicants.userId),
    )
    .leftJoin(hackerRsvps, eq(hackerRsvps.applicationId, hackerApplicants.id))
    .where(
      and(
        eq(applicationSlugSql, parsed.data),
        inArray(hackerApplicants.decision, RSVP_ELIGIBLE_DECISIONS),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    summary: rowToSummary(row),
    values: row.final
      ? rsvpRowToFormData(row.final, row.application, row.accountEmail ?? "")
      : null,
  };
}

export async function getAdminRsvpExportRows(): Promise<AdminRsvpExportRow[]> {
  await requireOrganizer();
  const rows = await selectAdminRsvpRows();
  return rows.map((row) => {
    const summary = rowToSummary(row);
    const values = row.final
      ? rsvpRowToFormData(row.final, row.application, row.accountEmail ?? "")
      : null;
    return {
      applicationSlug: summary.applicationSlug,
      applicationName: summary.applicationName,
      accountEmail: summary.accountEmail,
      status: summary.status,
      submittedAt: summary.submittedAt,
      values,
    };
  });
}

export async function getAdminRsvpReceipt(
  slug: string,
): Promise<RsvpReceiptDownloadRecord | null> {
  await requireOrganizer();
  const parsed = applicationSlugSchema.safeParse(slug);
  if (!parsed.success) return null;

  const [row] = await db
    .select({
      userId: hackerApplicants.userId,
      key: hackerRsvps.receiptKey,
      originalName: hackerRsvps.receiptOriginalName,
      contentType: hackerRsvps.receiptContentType,
      sizeBytes: hackerRsvps.receiptSizeBytes,
    })
    .from(hackerApplicants)
    .innerJoin(hackerRsvps, eq(hackerRsvps.applicationId, hackerApplicants.id))
    .where(
      and(
        eq(applicationSlugSql, parsed.data),
        inArray(hackerApplicants.decision, RSVP_ELIGIBLE_DECISIONS),
      ),
    )
    .limit(1);

  if (
    !row?.key ||
    !row.originalName ||
    !row.contentType ||
    !isRsvpReceiptContentType(row.contentType) ||
    !row.sizeBytes
  ) {
    return null;
  }

  return {
    key: row.key,
    userId: row.userId,
    originalName: row.originalName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
  };
}
