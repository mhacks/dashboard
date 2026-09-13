import { Suspense } from "react";
import { eq } from "drizzle-orm";
import ApplyPage from "./application-form";
import ApplicationFormSkeleton from "./application-form-skeleton";
import { requireSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  hackerApplicants,
  hackerApplicationDrafts,
} from "@/lib/db/schema/applications";
import { getResumeDownloadUrl } from "@/lib/actions/resume.server.actions";
import { getApplicationRound } from "@/lib/types/application-reviews";
import {
  APPLICATION_CLOSE_ISO,
  isApplicationOpen,
} from "@/lib/applications/deadline";

export const dynamic = "force-dynamic";

export default async function ApplicationFormPage() {
  const { id: userId } = await requireSessionUser();
  const applicationsOpen = isApplicationOpen();

  let existingApp = null;
  try {
    const existing = await db
      .select()
      .from(hackerApplicants)
      .where(eq(hackerApplicants.userId, userId))
      .limit(1);
    existingApp = existing[0] ?? null;
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] hacker_applicants query failed:", cause);
  }

  // If application already submitted, show read-only view — no draft needed
  if (existingApp) {
    let resumeUrl: string | null = null;
    if (existingApp.resume) {
      try {
        resumeUrl = await getResumeDownloadUrl(existingApp.resume);
      } catch (err) {
        console.error("[S3] Failed to generate resume download URL:", err);
      }
    }
    return (
      <Suspense fallback={<ApplicationFormSkeleton />}>
        <ApplyPage
          existingData={existingApp}
          draftData={null}
          resumeUrl={resumeUrl}
          showTravelReimbursementQuestions={
            getApplicationRound(existingApp.createdAt) === "early"
          }
          applicationsCloseAt={APPLICATION_CLOSE_ISO}
          initialApplicationsOpen={applicationsOpen}
        />
      </Suspense>
    );
  }

  // Create a draft row if one doesn't exist yet while applications are open,
  // then load it. After the cutoff, only read an existing draft so visiting
  // the closed form cannot create new application data.
  let draftData: Record<string, unknown> = {};
  let resumeUrl: string | null = null;
  try {
    if (applicationsOpen) {
      await db
        .insert(hackerApplicationDrafts)
        .values({ userId, data: {} })
        .onConflictDoNothing();
    }

    const draft = await db
      .select()
      .from(hackerApplicationDrafts)
      .where(eq(hackerApplicationDrafts.userId, userId))
      .limit(1);

    draftData = (draft[0]?.data as Record<string, unknown>) ?? {};

    const resumeKey = draftData.resume as string | undefined;
    if (resumeKey) {
      try {
        resumeUrl = await getResumeDownloadUrl(resumeKey);
      } catch (err) {
        console.error("[S3] Failed to generate resume download URL:", err);
      }
    }
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] hacker_application_drafts upsert failed:", cause);
  }

  return (
    <Suspense fallback={<ApplicationFormSkeleton />}>
      <ApplyPage
        existingData={null}
        draftData={draftData}
        resumeUrl={resumeUrl}
        showTravelReimbursementQuestions={
          getApplicationRound(new Date().toISOString()) === "early"
        }
        applicationsCloseAt={APPLICATION_CLOSE_ISO}
        initialApplicationsOpen={applicationsOpen}
      />
    </Suspense>
  );
}
