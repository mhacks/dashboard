"use server";

import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
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
import { getSessionUser } from "@/lib/auth/session";
import {
  reviewCompleteSchema,
  reviewDraftSchema,
  reviewEventsInputSchema,
  type AnalyticsBucket,
  type ApplicationAnalyticsData,
  type ReviewCompleteInput,
  type ReviewCounts,
  type ReviewAuditEventRecord,
  type ReviewDraftInput,
  type ReviewEventRecord,
  type ReviewLeaderboardData,
  type ReviewLeaderboardRow,
  type ReviewListItem,
  type ReviewRecord,
} from "@/lib/types/application-reviews";
import { getResumeDownloadUrl } from "@/lib/actions/resume.server.actions";

const MAX_REVIEW_EVENTS_PER_APPLICATION = 50;

async function requireOrganizer(): Promise<UserEntry> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  if (user.role !== "organizer") throw new Error("Forbidden");
  return user;
}

function parseActionInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid input");
  return parsed.data;
}

function countStatuses(items: ReviewListItem[]): ReviewCounts {
  return items.reduce<ReviewCounts>(
    (counts, item) => {
      counts.total += 1;
      counts[item.application.status] += 1;
      return counts;
    },
    { total: 0, pending: 0, reviewed: 0, flagged: 0 },
  );
}

function percent(count: number, total: number) {
  if (total === 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (valid.length === 0) return null;
  return (
    Math.round(
      (valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10,
    ) / 10
  );
}

function bucketize(
  values: string[],
  total: number,
  limit?: number,
): AnalyticsBucket[] {
  const counts = new Map<string, number>();

  for (const rawValue of values) {
    const value = rawValue.trim() || "Not provided";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: percent(count, total),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label);
    })
    .slice(0, limit);
}

function ageBucket(age: number) {
  if (age <= 19) return "18-19";
  if (age <= 21) return "20-21";
  if (age <= 24) return "22-24";
  return "25+";
}

function previousHackathonBucket(count: number) {
  if (count === 0) return "0";
  if (count <= 2) return "1-2";
  if (count <= 5) return "3-5";
  return "6+";
}

const US_STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

function stateFromComingFrom(value: string) {
  const segments = value
    .split(",")
    .map((segment) => segment.trim().toUpperCase())
    .filter(Boolean);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (US_STATE_CODES.has(segments[index])) return segments[index];
  }
  return null;
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

function applicantName(firstName: string | null, lastName: string | null) {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return name || "Unnamed applicant";
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

export async function getApplicationReviewDashboard(): Promise<{
  currentUser: Pick<UserEntry, "id" | "email" | "role">;
  items: ReviewListItem[];
  counts: ReviewCounts;
}> {
  const currentUser = await requireOrganizer();

  const applications = await db
    .select({
      application: hackerApplicants,
      applicantEmail: users.email,
    })
    .from(hackerApplicants)
    .leftJoin(users, eq(hackerApplicants.userId, users.id))
    .orderBy(desc(hackerApplicants.createdAt));

  const applicationIds = applications.map(({ application }) => application.id);
  const reviews =
    applicationIds.length === 0
      ? []
      : await db
          .select({
            review: hackerApplicationReviews,
            reviewerEmail: users.email,
          })
          .from(hackerApplicationReviews)
          .leftJoin(
            users,
            eq(hackerApplicationReviews.reviewerUserId, users.id),
          )
          .where(
            inArray(hackerApplicationReviews.applicationId, applicationIds),
          );

  const reviewsByApplicationId = new Map(
    reviews.map(({ review, reviewerEmail }) => [
      review.applicationId,
      withReviewerEmail(review, reviewerEmail),
    ]),
  );

  const items = applications.map(({ application, applicantEmail }) => ({
    application: { ...application, applicantEmail },
    review: reviewsByApplicationId.get(application.id) ?? null,
  }));

  return {
    currentUser: {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    },
    items,
    counts: countStatuses(items),
  };
}

export async function saveApplicationReviewDraft(
  input: ReviewDraftInput,
): Promise<{ review: ReviewRecord; event: ReviewEventRecord | null }> {
  const currentUser = await requireOrganizer();
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
      reviewerUserId: currentUser.id,
      effortRating: parsed.effortRating,
      builderRating: parsed.builderRating,
      flaggedForReview: parsed.flaggedForReview,
      reviewComments,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: hackerApplicationReviews.applicationId,
      set: {
        reviewerUserId: currentUser.id,
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
    reviewer: currentUser,
    eventType: "draft_saved",
    applicationStatus: application?.status ?? "pending",
  });

  return { review: withReviewerEmail(review, currentUser.email), event };
}

export async function markApplicationReviewed(
  input: ReviewCompleteInput,
): Promise<{
  review: ReviewRecord;
  event: ReviewEventRecord | null;
  status: "reviewed" | "flagged";
}> {
  const currentUser = await requireOrganizer();
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
      reviewerUserId: currentUser.id,
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
        reviewerUserId: currentUser.id,
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
    reviewer: currentUser,
    eventType: "review_completed",
    applicationStatus: status,
    force: true,
  });

  return {
    review: withReviewerEmail(review, currentUser.email),
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

export async function getApplicationReviewLeaderboard(): Promise<ReviewLeaderboardData> {
  const currentUser = await requireOrganizer();

  const organizers = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.role, "organizer"));

  const completedReviews = await db
    .select({
      review: hackerApplicationReviews,
      reviewerEmail: users.email,
    })
    .from(hackerApplicationReviews)
    .leftJoin(users, eq(hackerApplicationReviews.reviewerUserId, users.id))
    .where(isNotNull(hackerApplicationReviews.reviewedAt));

  const auditEvents = await db
    .select({
      event: hackerApplicationReviewEvents,
      reviewerEmail: users.email,
      applicationStatus: hackerApplicants.status,
      firstName: hackerApplicants.firstName,
      lastName: hackerApplicants.lastName,
    })
    .from(hackerApplicationReviewEvents)
    .leftJoin(users, eq(hackerApplicationReviewEvents.reviewerUserId, users.id))
    .leftJoin(
      hackerApplicants,
      eq(hackerApplicationReviewEvents.applicationId, hackerApplicants.id),
    )
    .orderBy(desc(hackerApplicationReviewEvents.createdAt));

  const rowsByReviewerId = new Map<string, ReviewLeaderboardRow>();

  function ensureRow(reviewerUserId: string, reviewerEmail: string | null) {
    const existing = rowsByReviewerId.get(reviewerUserId);
    if (existing) {
      if (existing.reviewerEmail === "Unknown organizer" && reviewerEmail) {
        existing.reviewerEmail = reviewerEmail;
      }
      return existing;
    }

    const row: ReviewLeaderboardRow = {
      reviewerUserId,
      reviewerEmail: reviewerEmail ?? "Unknown organizer",
      completedApplications: 0,
      reviewedApplications: 0,
      flaggedApplications: 0,
      lastActivityAt: null,
    };
    rowsByReviewerId.set(reviewerUserId, row);
    return row;
  }

  for (const organizer of organizers) {
    ensureRow(organizer.id, organizer.email);
  }

  for (const { review, reviewerEmail } of completedReviews) {
    if (!review.reviewedAt) continue;
    const row = ensureRow(review.reviewerUserId, reviewerEmail);
    row.completedApplications += 1;
    if (review.flaggedForReview) {
      row.flaggedApplications += 1;
    } else {
      row.reviewedApplications += 1;
    }
    if (!row.lastActivityAt || review.reviewedAt > row.lastActivityAt) {
      row.lastActivityAt = review.reviewedAt;
    }
  }

  const recentEvents: ReviewAuditEventRecord[] = [];

  for (const {
    event,
    reviewerEmail,
    applicationStatus,
    firstName,
    lastName,
  } of auditEvents) {
    if (recentEvents.length < 100) {
      recentEvents.push({
        ...withReviewEventEmail(event, reviewerEmail),
        applicationName: applicantName(firstName, lastName),
        applicationStatus: applicationStatus ?? "pending",
      });
    }
  }

  const rows = Array.from(rowsByReviewerId.values()).sort((left, right) => {
    if (right.completedApplications !== left.completedApplications) {
      return right.completedApplications - left.completedApplications;
    }
    if (right.flaggedApplications !== left.flaggedApplications) {
      return right.flaggedApplications - left.flaggedApplications;
    }
    return left.reviewerEmail.localeCompare(right.reviewerEmail);
  });

  return {
    currentUser: {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    },
    rows,
    recentEvents,
    totals: {
      completedApplications: completedReviews.length,
      draftEvents: auditEvents.filter(
        ({ event }) => event.eventType === "draft_saved",
      ).length,
      completionEvents: auditEvents.filter(
        ({ event }) => event.eventType === "review_completed",
      ).length,
      totalEvents: auditEvents.length,
      activeReviewers: rows.filter((row) => row.completedApplications > 0)
        .length,
    },
  };
}

export async function getApplicationAnalytics(): Promise<ApplicationAnalyticsData> {
  const currentUser = await requireOrganizer();

  const applications = await db.select().from(hackerApplicants);
  const reviews = await db.select().from(hackerApplicationReviews);
  const total = applications.length;

  const reviewedScores = reviews.filter(
    (review) =>
      review.reviewedAt &&
      typeof review.effortRating === "number" &&
      typeof review.builderRating === "number",
  );
  const overallScores = reviewedScores.map(
    (review) => ((review.effortRating ?? 0) + (review.builderRating ?? 0)) / 2,
  );

  const counts = applications.reduce<ReviewCounts>(
    (statusCounts, application) => {
      statusCounts.total += 1;
      statusCounts[application.status] += 1;
      return statusCounts;
    },
    { total: 0, pending: 0, reviewed: 0, flagged: 0 },
  );

  const ages = applications.map((application) => application.age);
  const usStates = applications
    .map((application) => stateFromComingFrom(application.comingFrom))
    .filter((state): state is string => Boolean(state));

  return {
    currentUser: {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    },
    totals: {
      applicants: total,
      pending: counts.pending,
      reviewed: counts.reviewed,
      flagged: counts.flagged,
      averageAge: average(ages),
      youngestAge: ages.length ? Math.min(...ages) : null,
      oldestAge: ages.length ? Math.max(...ages) : null,
    },
    scores: {
      reviewedApplications: reviewedScores.length,
      effortAverage: average(
        reviewedScores.map((review) => review.effortRating),
      ),
      builderAverage: average(
        reviewedScores.map((review) => review.builderRating),
      ),
      overallAverage: average(overallScores),
    },
    demographics: {
      gender: bucketize(
        applications.map((application) => application.gender),
        total,
      ),
      ethnicity: bucketize(
        applications.map((application) => application.ethnicity),
        total,
      ),
      degree: bucketize(
        applications.map((application) => application.degree),
        total,
      ),
      major: bucketize(
        applications.map((application) => application.major),
        total,
        10,
      ),
      graduationYear: bucketize(
        applications.map((application) => String(application.graduationYear)),
        total,
      ),
      ageBuckets: bucketize(
        applications.map((application) => ageBucket(application.age)),
        total,
      ),
    },
    locations: {
      countries: bucketize(
        applications.map((application) => application.country),
        total,
      ),
      usStates: bucketize(usStates, total),
      comingFrom: bucketize(
        applications.map((application) => application.comingFrom),
        total,
        10,
      ),
    },
    academics: {
      universities: bucketize(
        applications.map((application) => application.university),
        total,
        10,
      ),
      previousHackathonBuckets: bucketize(
        applications.map((application) =>
          previousHackathonBucket(application.previousHackathons),
        ),
        total,
      ),
    },
  };
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
