"use server";

import { desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/lib/db";
import {
  hackerApplicants,
  hackerApplicationReviewEvents,
  hackerApplicationReviews,
  type HackerApplicationReviewEventRow,
  type HackerApplicationReviewRow,
  type ReviewEventChanges,
  type ReviewEventSnapshot,
} from "@/lib/db/schema/applications";
import { users, type UserEntry } from "@/lib/db/schema/users";
import { requireOrganizer } from "@/lib/auth/guards";
import {
  reviewCompleteSchema,
  reviewDraftSchema,
  reviewEventsInputSchema,
  type ReviewCompleteInput,
  type ReviewDraftInput,
  type ReviewEventRecord,
  type ReviewListItem,
  type ReviewRecord,
} from "@/lib/types/application-reviews";
import { getResumeDownloadUrl } from "@/lib/actions/resume.server.actions";

const MAX_REVIEW_EVENTS_PER_APPLICATION = 50;

function parseActionInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid input");
  return parsed.data;
}

function withReviewerEmail(
  review: HackerApplicationReviewRow,
  reviewerEmail: string | null,
): ReviewRecord {
  return { ...review, reviewerEmail };
}

function withReviewEventEmail(
  event: HackerApplicationReviewEventRow,
  reviewerEmail: string | null,
): ReviewEventRecord {
  return { ...event, reviewerEmail };
}

function reviewSnapshot(
  review: HackerApplicationReviewRow,
  applicationStatus: ReviewListItem["application"]["status"],
): ReviewEventSnapshot {
  return {
    effortRating: review.effortRating,
    builderRating: review.builderRating,
    flaggedForReview: review.flaggedForReview,
    reviewComments: review.reviewComments,
    reviewedAt: review.reviewedAt,
    applicationStatus,
  };
}

function reviewChanges(
  previous: HackerApplicationReviewRow | null,
  next: HackerApplicationReviewRow,
): ReviewEventChanges {
  const changes: ReviewEventChanges = {};
  const fields = [
    "effortRating",
    "builderRating",
    "flaggedForReview",
    "reviewComments",
    "reviewedAt",
  ] as const;

  for (const field of fields) {
    const from = previous?.[field] ?? null;
    const to = next[field] ?? null;
    if (from !== to) changes[field] = { from, to };
  }

  return changes;
}

async function recordReviewEvent({
  review,
  previous,
  reviewer,
  eventType,
  applicationStatus,
  force = false,
}: {
  review: HackerApplicationReviewRow;
  previous: HackerApplicationReviewRow | null;
  reviewer: Pick<UserEntry, "id" | "email">;
  eventType: "draft_saved" | "review_completed";
  applicationStatus: ReviewListItem["application"]["status"];
  force?: boolean;
}): Promise<ReviewEventRecord | null> {
  const changes = reviewChanges(previous, review);
  if (!force && Object.keys(changes).length === 0) return null;

  const [event] = await db
    .insert(hackerApplicationReviewEvents)
    .values({
      reviewId: review.id,
      applicationId: review.applicationId,
      reviewerUserId: reviewer.id,
      eventType,
      changes,
      snapshot: reviewSnapshot(review, applicationStatus),
    })
    .returning();

  await pruneReviewEvents(review.applicationId);

  return withReviewEventEmail(event, reviewer.email);
}

async function pruneReviewEvents(applicationId: string) {
  await db.execute(sql`
    delete from ${hackerApplicationReviewEvents}
    where ${hackerApplicationReviewEvents.id} in (
      select id
      from (
        select
          id,
          row_number() over (
            partition by application_id
            order by created_at desc, id desc
          ) as event_rank
        from ${hackerApplicationReviewEvents}
        where ${hackerApplicationReviewEvents.applicationId} = ${applicationId}
      ) ranked_events
      where event_rank > ${MAX_REVIEW_EVENTS_PER_APPLICATION}
    )
  `);
}

export async function saveApplicationReviewDraft(
  input: ReviewDraftInput,
): Promise<{ review: ReviewRecord; event: ReviewEventRecord | null }> {
  const organizer = await requireOrganizer();
  const parsed = parseActionInput(reviewDraftSchema, input);
  const now = new Date().toISOString();
  const reviewComments = parsed.flaggedForReview ? parsed.reviewComments : null;

  const [previousReview] = await db
    .select()
    .from(hackerApplicationReviews)
    .where(eq(hackerApplicationReviews.applicationId, parsed.applicationId))
    .limit(1);
  const [application] = await db
    .select({ status: hackerApplicants.status })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.id, parsed.applicationId))
    .limit(1);

  const [review] = await db
    .insert(hackerApplicationReviews)
    .values({
      applicationId: parsed.applicationId,
      reviewerUserId: organizer.id,
      effortRating: parsed.effortRating,
      builderRating: parsed.builderRating,
      flaggedForReview: parsed.flaggedForReview,
      reviewComments,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: hackerApplicationReviews.applicationId,
      set: {
        reviewerUserId: organizer.id,
        effortRating: parsed.effortRating,
        builderRating: parsed.builderRating,
        flaggedForReview: parsed.flaggedForReview,
        reviewComments,
        updatedAt: now,
      },
    })
    .returning();

  const event = await recordReviewEvent({
    review,
    previous: previousReview ?? null,
    reviewer: organizer,
    eventType: "draft_saved",
    applicationStatus: application?.status ?? "pending",
  });

  return { review: withReviewerEmail(review, organizer.email), event };
}

export async function markApplicationReviewed(
  input: ReviewCompleteInput,
): Promise<{
  review: ReviewRecord;
  event: ReviewEventRecord | null;
  status: "reviewed" | "flagged";
}> {
  const organizer = await requireOrganizer();
  const parsed = parseActionInput(reviewCompleteSchema, input);
  const now = new Date().toISOString();
  const status = parsed.flaggedForReview ? "flagged" : "reviewed";
  const reviewComments = parsed.flaggedForReview ? parsed.reviewComments : null;

  const [previousReview] = await db
    .select()
    .from(hackerApplicationReviews)
    .where(eq(hackerApplicationReviews.applicationId, parsed.applicationId))
    .limit(1);

  const [review] = await db
    .insert(hackerApplicationReviews)
    .values({
      applicationId: parsed.applicationId,
      reviewerUserId: organizer.id,
      effortRating: parsed.effortRating,
      builderRating: parsed.builderRating,
      flaggedForReview: parsed.flaggedForReview,
      reviewComments,
      reviewedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: hackerApplicationReviews.applicationId,
      set: {
        reviewerUserId: organizer.id,
        effortRating: parsed.effortRating,
        builderRating: parsed.builderRating,
        flaggedForReview: parsed.flaggedForReview,
        reviewComments,
        reviewedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  await db
    .update(hackerApplicants)
    .set({ status, updatedAt: now })
    .where(eq(hackerApplicants.id, parsed.applicationId));

  const event = await recordReviewEvent({
    review,
    previous: previousReview ?? null,
    reviewer: organizer,
    eventType: "review_completed",
    applicationStatus: status,
    force: true,
  });

  return {
    review: withReviewerEmail(review, organizer.email),
    event,
    status,
  };
}

export async function getApplicationReviewEvents(
  applicationId: string,
): Promise<ReviewEventRecord[]> {
  await requireOrganizer();
  const parsed = parseActionInput(reviewEventsInputSchema, { applicationId });

  const events = await db
    .select({
      event: hackerApplicationReviewEvents,
      reviewerEmail: users.email,
    })
    .from(hackerApplicationReviewEvents)
    .leftJoin(users, eq(hackerApplicationReviewEvents.reviewerUserId, users.id))
    .where(
      eq(hackerApplicationReviewEvents.applicationId, parsed.applicationId),
    )
    .orderBy(desc(hackerApplicationReviewEvents.createdAt));

  return events.map(({ event, reviewerEmail }) =>
    withReviewEventEmail(event, reviewerEmail),
  );
}

export async function getApplicationReviewResumeUrl(
  applicationId: string,
): Promise<string | null> {
  await requireOrganizer();
  const parsed = parseActionInput(reviewEventsInputSchema, { applicationId });

  const [application] = await db
    .select({ resume: hackerApplicants.resume })
    .from(hackerApplicants)
    .where(eq(hackerApplicants.id, parsed.applicationId))
    .limit(1);

  if (!application?.resume) return null;
  return getResumeDownloadUrl(application.resume);
}
