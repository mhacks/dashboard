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
  reviewCompleteSaveSchema,
  reviewEventsInputSchema,
  type ReviewCompleteSaveInput,
  type ReviewCompleteSaveResult,
  type ReviewEventRecord,
  type ReviewListItem,
  type ReviewRecord,
} from "@/lib/types/application-reviews";

const MAX_REVIEW_EVENTS_PER_APPLICATION = 50;

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

async function recordReviewEvent(
  {
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
  },
  tx: DbTx,
): Promise<ReviewEventRecord | null> {
  const changes = reviewChanges(previous, review);
  if (!force && Object.keys(changes).length === 0) return null;

  const [event] = await tx
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

  await pruneReviewEvents(review.applicationId, tx);

  return withReviewEventEmail(event, reviewer.email);
}

async function pruneReviewEvents(applicationId: string, tx: DbTx) {
  await tx.execute(sql`
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

function reviewVersionToken(
  review: HackerApplicationReviewRow | null | undefined,
): string | null {
  return review?.updatedAt ?? null;
}

async function reviewRecordWithEmail(
  review: HackerApplicationReviewRow,
  tx: DbTx,
): Promise<ReviewRecord> {
  const [reviewer] = await tx
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, review.reviewerUserId))
    .limit(1);

  return withReviewerEmail(review, reviewer?.email ?? null);
}

async function conflictResult(
  existing: HackerApplicationReviewRow | null,
  tx: DbTx,
): Promise<ReviewSaveConflict> {
  return {
    ok: false,
    code: "conflict",
    review: existing ? await reviewRecordWithEmail(existing, tx) : null,
  };
}

type ReviewSaveConflict = Extract<ReviewCompleteSaveResult, { ok: false }>;

const computedApplicationSlug = sql<string>`'app_' || substring(md5(${hackerApplicants.userId}::text) from 1 for 24)`;

export async function markApplicationReviewed(
  input: ReviewCompleteSaveInput,
): Promise<ReviewCompleteSaveResult> {
  const organizer = await requireOrganizer();
  const parsed = parseActionInput(reviewCompleteSaveSchema, input);
  const now = new Date().toISOString();
  const status = parsed.flaggedForReview ? "flagged" : "reviewed";
  const reviewComments = parsed.flaggedForReview ? parsed.reviewComments : null;

  return db.transaction(async (tx) => {
    const [application] = await tx
      .select({ id: hackerApplicants.id })
      .from(hackerApplicants)
      .where(eq(hackerApplicants.id, parsed.applicationId))
      .for("update");

    if (!application) throw new Error("Application not found");

    const [previousReview] = await tx
      .select()
      .from(hackerApplicationReviews)
      .where(eq(hackerApplicationReviews.applicationId, parsed.applicationId))
      .limit(1);

    if (reviewVersionToken(previousReview) !== parsed.expectedUpdatedAt) {
      return conflictResult(previousReview ?? null, tx);
    }

    const [review] = await tx
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

    await tx
      .update(hackerApplicants)
      .set({ status, updatedAt: now })
      .where(eq(hackerApplicants.id, parsed.applicationId));

    const event = await recordReviewEvent(
      {
        review,
        previous: previousReview ?? null,
        reviewer: organizer,
        eventType: "review_completed",
        applicationStatus: status,
        force: true,
      },
      tx,
    );

    return {
      ok: true,
      review: withReviewerEmail(review, organizer.email),
      event,
      status,
    };
  });
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

export async function getApplicationReviewDetail(
  applicationId: string,
): Promise<ReviewListItem> {
  await requireOrganizer();
  const parsed = parseActionInput(reviewEventsInputSchema, { applicationId });

  const [application] = await db
    .select({
      application: hackerApplicants,
      slug: computedApplicationSlug,
      applicantEmail: users.email,
    })
    .from(hackerApplicants)
    .leftJoin(users, eq(hackerApplicants.userId, users.id))
    .where(eq(hackerApplicants.id, parsed.applicationId))
    .limit(1);

  if (!application) throw new Error("Application not found");

  const [review] = await db
    .select({
      review: hackerApplicationReviews,
      reviewerEmail: users.email,
    })
    .from(hackerApplicationReviews)
    .leftJoin(users, eq(hackerApplicationReviews.reviewerUserId, users.id))
    .where(eq(hackerApplicationReviews.applicationId, parsed.applicationId))
    .limit(1);

  return {
    application: {
      ...application.application,
      slug: application.slug,
      applicantEmail: application.applicantEmail,
    },
    review: review
      ? withReviewerEmail(review.review, review.reviewerEmail)
      : null,
  };
}
