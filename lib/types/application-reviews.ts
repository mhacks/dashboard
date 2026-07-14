import { z } from "zod";
import type {
  HackerApplicantRow,
  HackerApplicationReviewEventRow,
  HackerApplicationReviewRow,
  ReviewEventChanges,
  ReviewEventSnapshot,
} from "@/lib/db/schema/applications";

const draftRatingSchema = z
  .number()
  .int("Rating must be a whole number")
  .min(1, "Rating must be between 1 and 5")
  .max(5, "Rating must be between 1 and 5")
  .nullable();

const finalRatingSchema = z
  .number({ message: "Rating is required" })
  .int("Rating must be a whole number")
  .min(1, "Rating must be between 1 and 5")
  .max(5, "Rating must be between 1 and 5");

export const reviewDraftSchema = z.object({
  applicationId: z.uuid(),
  effortRating: draftRatingSchema,
  builderRating: draftRatingSchema,
  flaggedForReview: z.boolean(),
  reviewComments: z.string().max(3000, "Comments are too long").nullable(),
});

export const reviewCompleteSchema = reviewDraftSchema
  .extend({
    effortRating: finalRatingSchema,
    builderRating: finalRatingSchema,
  })
  .superRefine((data, ctx) => {
    if (data.flaggedForReview && !data.reviewComments?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Please explain why this application is flagged",
        path: ["reviewComments"],
      });
    }
  });

export const reviewEventsInputSchema = z.object({
  applicationId: z.uuid(),
});

export const reviewSyncReviewSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  reviewerUserId: z.uuid(),
  effortRating: draftRatingSchema,
  builderRating: draftRatingSchema,
  flaggedForReview: z.boolean(),
  reviewComments: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewerEmail: z.string().nullable(),
});

export const reviewSyncEventSchema = z.object({
  id: z.uuid(),
  reviewId: z.uuid(),
  applicationId: z.uuid(),
  reviewerUserId: z.uuid(),
  eventType: z.enum(["draft_saved", "review_completed"]),
  changes: z.record(
    z.string(),
    z.object({
      from: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      to: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    }),
  ),
  snapshot: z.object({
    effortRating: draftRatingSchema,
    builderRating: draftRatingSchema,
    flaggedForReview: z.boolean(),
    reviewComments: z.string().nullable(),
    reviewedAt: z.string().nullable(),
    applicationStatus: z.enum(["pending", "reviewed", "flagged"]),
  }),
  createdAt: z.string(),
  reviewerEmail: z.string().nullable(),
});

export const reviewSyncPayloadSchema = z.object({
  sourceUserId: z.uuid(),
  applicationId: z.uuid(),
  review: reviewSyncReviewSchema,
  status: z.enum(["pending", "reviewed", "flagged"]).optional(),
  event: reviewSyncEventSchema.nullable(),
});

export type ReviewSyncPayload = z.infer<typeof reviewSyncPayloadSchema>;

export type ReviewDraftInput = z.infer<typeof reviewDraftSchema>;
export type ReviewCompleteInput = z.infer<typeof reviewCompleteSchema>;
export type ReviewEventsInput = z.infer<typeof reviewEventsInputSchema>;

export type ReviewApplication = HackerApplicantRow & {
  applicantEmail: string | null;
};

export type ReviewRecord = HackerApplicationReviewRow & {
  reviewerEmail: string | null;
};

export type ReviewEventRecord = HackerApplicationReviewEventRow & {
  reviewerEmail: string | null;
  changes: ReviewEventChanges;
  snapshot: ReviewEventSnapshot;
};

export type ReviewLeaderboardRow = {
  reviewerUserId: string;
  reviewerEmail: string;
  completedApplications: number;
  reviewedApplications: number;
  flaggedApplications: number;
  lastActivityAt: string | null;
};

export type ReviewAuditEventRecord = ReviewEventRecord & {
  applicationName: string;
  applicationStatus: ReviewApplication["status"];
};

export type ReviewApplicationSummary = {
  id: string;
  userId: string;
  status: ReviewApplication["status"];
  firstName: string;
  lastName: string;
  applicantEmail: string | null;
  university: string;
  major: string;
  whyMhacksPreview: string;
  createdAt: string;
};

export type ReviewListSummaryItem = {
  application: ReviewApplicationSummary;
  review: ReviewRecord | null;
};

export type ReviewWorkspaceData = {
  items: ReviewListSummaryItem[];
  counts: ReviewCounts;
};

export type ReviewLeaderboardData = {
  rows: ReviewLeaderboardRow[];
  recentEvents: ReviewAuditEventRecord[];
  totals: {
    completedApplications: number;
    draftEvents: number;
    completionEvents: number;
    totalEvents: number;
    activeReviewers: number;
  };
};

export type AnalyticsBucket = {
  label: string;
  count: number;
  percentage: number;
};

export type ScoreAnalytics = {
  reviewedApplications: number;
  effortRatings: AnalyticsBucket[];
  builderRatings: AnalyticsBucket[];
};

export type ApplicationAnalyticsData = {
  totals: {
    applicants: number;
    pending: number;
    reviewed: number;
    flagged: number;
    averageAge: number | null;
    youngestAge: number | null;
    oldestAge: number | null;
  };
  statusBreakdown: AnalyticsBucket[];
  scores: ScoreAnalytics;
  demographics: {
    gender: AnalyticsBucket[];
    ethnicity: AnalyticsBucket[];
    degree: AnalyticsBucket[];
    major: AnalyticsBucket[];
    graduationYear: AnalyticsBucket[];
    ageBuckets: AnalyticsBucket[];
  };
  locations: {
    countries: AnalyticsBucket[];
    usStates: AnalyticsBucket[];
    comingFrom: AnalyticsBucket[];
  };
  academics: {
    universities: AnalyticsBucket[];
    previousHackathonBuckets: AnalyticsBucket[];
  };
};

export type ReviewListItem = {
  application: ReviewApplication;
  review: ReviewRecord | null;
};

export type ReviewCounts = {
  total: number;
  pending: number;
  reviewed: number;
  flagged: number;
};
