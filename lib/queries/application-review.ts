import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  hackerApplicants,
  hackerApplicationReviewEvents,
  hackerApplicationReviews,
  type HackerApplicationReviewEventRow,
  type HackerApplicationReviewRow,
} from "@/lib/db/schema/applications";
import { users } from "@/lib/db/schema/users";
import {
  type AnalyticsBucket,
  type ApplicationAnalyticsData,
  type ReviewAuditEventRecord,
  type ReviewCounts,
  type ReviewEventRecord,
  type ReviewLeaderboardData,
  type ReviewLeaderboardRow,
  type ReviewListSummaryItem,
  type ReviewRecord,
  type ReviewWorkspaceData,
} from "@/lib/types/application-reviews";

const WHY_MHACKS_PREVIEW_LENGTH = 160;

function countStatuses(items: ReviewListSummaryItem[]): ReviewCounts {
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

function bucketizeOrdered(
  values: string[],
  total: number,
  order: string[],
): AnalyticsBucket[] {
  const counts = new Map<string, number>();

  for (const rawValue of values) {
    const value = rawValue.trim() || "Not provided";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const buckets = order.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
    percentage: percent(counts.get(label) ?? 0, total),
  }));

  for (const [label, count] of counts.entries()) {
    if (!order.includes(label)) {
      buckets.push({
        label,
        count,
        percentage: percent(count, total),
      });
    }
  }

  return buckets;
}

function sortGraduationYearBuckets(
  buckets: AnalyticsBucket[],
): AnalyticsBucket[] {
  return [...buckets].sort((left, right) => {
    if (left.label === "Not provided") return 1;
    if (right.label === "Not provided") return -1;

    const leftYear = Number.parseInt(left.label, 10);
    const rightYear = Number.parseInt(right.label, 10);

    if (Number.isNaN(leftYear) && Number.isNaN(rightYear)) {
      return left.label.localeCompare(right.label);
    }
    if (Number.isNaN(leftYear)) return 1;
    if (Number.isNaN(rightYear)) return -1;
    return leftYear - rightYear;
  });
}

function ratingHistogram(
  ratings: Array<number | null | undefined>,
): AnalyticsBucket[] {
  const counts = new Map([1, 2, 3, 4, 5].map((rating) => [rating, 0]));
  let total = 0;

  for (const rating of ratings) {
    if (typeof rating !== "number" || rating < 1 || rating > 5) continue;
    counts.set(rating, (counts.get(rating) ?? 0) + 1);
    total += 1;
  }

  if (total === 0) return [];

  return [1, 2, 3, 4, 5].map((rating) => ({
    label: String(rating),
    count: counts.get(rating) ?? 0,
    percentage: percent(counts.get(rating) ?? 0, total),
  }));
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

export async function getApplicationReviewDashboard(): Promise<ReviewWorkspaceData> {
  await requireOrganizer();

  const applications = await db
    .select({
      id: hackerApplicants.id,
      userId: hackerApplicants.userId,
      status: hackerApplicants.status,
      firstName: hackerApplicants.firstName,
      lastName: hackerApplicants.lastName,
      university: hackerApplicants.university,
      major: hackerApplicants.major,
      whyMhacks: hackerApplicants.whyMhacks,
      createdAt: hackerApplicants.createdAt,
      applicantEmail: users.email,
    })
    .from(hackerApplicants)
    .leftJoin(users, eq(hackerApplicants.userId, users.id))
    .orderBy(desc(hackerApplicants.createdAt));

  const applicationIds = applications.map((application) => application.id);
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

  const items: ReviewListSummaryItem[] = applications.map((application) => {
    const trimmed = application.whyMhacks.trim();
    const whyMhacksPreview =
      trimmed.length <= WHY_MHACKS_PREVIEW_LENGTH
        ? trimmed
        : `${trimmed.slice(0, WHY_MHACKS_PREVIEW_LENGTH).trimEnd()}…`;

    return {
      application: {
        id: application.id,
        userId: application.userId,
        status: application.status,
        firstName: application.firstName,
        lastName: application.lastName,
        applicantEmail: application.applicantEmail,
        university: application.university,
        major: application.major,
        whyMhacksPreview,
        createdAt: application.createdAt,
      },
      review: reviewsByApplicationId.get(application.id) ?? null,
    };
  });

  return {
    items,
    counts: countStatuses(items),
  };
}

export async function getApplicationReviewLeaderboard(): Promise<ReviewLeaderboardData> {
  await requireOrganizer();

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
    .orderBy(desc(hackerApplicationReviewEvents.createdAt))
    .limit(100);

  const [auditTotals] = await db
    .select({
      draftEvents: sql<number>`count(*) filter (where ${hackerApplicationReviewEvents.eventType} = 'draft_saved')::int`,
      completionEvents: sql<number>`count(*) filter (where ${hackerApplicationReviewEvents.eventType} = 'review_completed')::int`,
      totalEvents: sql<number>`count(*)::int`,
    })
    .from(hackerApplicationReviewEvents);

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
    rows,
    recentEvents,
    totals: {
      completedApplications: completedReviews.length,
      draftEvents: auditTotals?.draftEvents ?? 0,
      completionEvents: auditTotals?.completionEvents ?? 0,
      totalEvents: auditTotals?.totalEvents ?? 0,
      activeReviewers: rows.filter((row) => row.completedApplications > 0)
        .length,
    },
  };
}

export async function getApplicationAnalytics(): Promise<ApplicationAnalyticsData> {
  await requireOrganizer();

  const applications = await db
    .select({
      id: hackerApplicants.id,
      status: hackerApplicants.status,
      age: hackerApplicants.age,
      gender: hackerApplicants.gender,
      ethnicity: hackerApplicants.ethnicity,
      degree: hackerApplicants.degree,
      major: hackerApplicants.major,
      graduationYear: hackerApplicants.graduationYear,
      previousHackathons: hackerApplicants.previousHackathons,
      university: hackerApplicants.university,
      country: hackerApplicants.country,
      comingFrom: hackerApplicants.comingFrom,
    })
    .from(hackerApplicants);
  const applicationIds = applications.map((application) => application.id);
  const reviews =
    applicationIds.length === 0
      ? []
      : await db
          .select({
            reviewedAt: hackerApplicationReviews.reviewedAt,
            effortRating: hackerApplicationReviews.effortRating,
            builderRating: hackerApplicationReviews.builderRating,
          })
          .from(hackerApplicationReviews)
          .where(
            inArray(hackerApplicationReviews.applicationId, applicationIds),
          );
  const total = applications.length;

  const reviewedScores = reviews.filter(
    (review) =>
      review.reviewedAt &&
      typeof review.effortRating === "number" &&
      typeof review.builderRating === "number",
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
    totals: {
      applicants: total,
      pending: counts.pending,
      reviewed: counts.reviewed,
      flagged: counts.flagged,
      averageAge: average(ages),
      youngestAge: ages.length ? Math.min(...ages) : null,
      oldestAge: ages.length ? Math.max(...ages) : null,
    },
    statusBreakdown: [
      {
        label: "Pending",
        count: counts.pending,
        percentage: percent(counts.pending, total),
      },
      {
        label: "Reviewed",
        count: counts.reviewed,
        percentage: percent(counts.reviewed, total),
      },
      {
        label: "Flagged",
        count: counts.flagged,
        percentage: percent(counts.flagged, total),
      },
    ],
    scores: {
      reviewedApplications: reviewedScores.length,
      effortRatings: ratingHistogram(
        reviewedScores.map((review) => review.effortRating),
      ),
      builderRatings: ratingHistogram(
        reviewedScores.map((review) => review.builderRating),
      ),
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
      ),
      graduationYear: sortGraduationYearBuckets(
        bucketize(
          applications.map((application) => String(application.graduationYear)),
          total,
        ),
      ),
      ageBuckets: bucketizeOrdered(
        applications.map((application) => ageBucket(application.age)),
        total,
        ["18-19", "20-21", "22-24", "25+"],
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
      ),
    },
    academics: {
      universities: bucketize(
        applications.map((application) => application.university),
        total,
      ),
      previousHackathonBuckets: bucketizeOrdered(
        applications.map((application) =>
          previousHackathonBucket(application.previousHackathons),
        ),
        total,
        ["0", "1-2", "3-5", "6+"],
      ),
    },
  };
}
