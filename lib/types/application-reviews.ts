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
  .number({ error: "Rating is required" })
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

export const reviewCompleteSchema = reviewDraftSchema.extend({
  effortRating: finalRatingSchema,
  builderRating: finalRatingSchema,
});

export const reviewEventsInputSchema = z.object({
  applicationId: z.uuid(),
});

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

export type ReviewLeaderboardData = {
  currentUser: {
    id: string;
    email: string;
    role: "hacker" | "organizer";
  };
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
  effortAverage: number | null;
  builderAverage: number | null;
  overallAverage: number | null;
};

export type ApplicationAnalyticsData = {
  currentUser: {
    id: string;
    email: string;
    role: "hacker" | "organizer";
  };
  totals: {
    applicants: number;
    pending: number;
    reviewed: number;
    flagged: number;
    averageAge: number | null;
    youngestAge: number | null;
    oldestAge: number | null;
  };
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
