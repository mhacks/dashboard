import { eq } from "drizzle-orm";

import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import type { ApplicationDecision } from "@/lib/decisions";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const { id: userId } = await requireSessionUser();

  let application: {
    firstName: string;
    decision: ApplicationDecision;
    createdAt: string;
  } | null = null;

  try {
    const rows = await db
      .select({
        firstName: hackerApplicants.firstName,
        decision: hackerApplicants.decision,
        createdAt: hackerApplicants.createdAt,
      })
      .from(hackerApplicants)
      .where(eq(hackerApplicants.userId, userId))
      .limit(1);
    application = rows[0] ?? null;
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] hacker_applicants query failed:", cause);
  }

  return (
    <DashboardClient
      firstName={application?.firstName ?? null}
      decision={application?.decision ?? null}
      submittedAt={application?.createdAt ?? null}
    />
  );
}
