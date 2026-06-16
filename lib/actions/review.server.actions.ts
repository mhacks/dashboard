"use server";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { type ReviewFormData } from "@/app/applications/review/hacker/review-criteria";
import { eq } from "drizzle-orm";

export const saveHackerReview = async (
  applicantId: string,
  data: ReviewFormData,
) => {
  await db
    .update(hackerApplicants)
    .set({
      reviewMotivation: data.motivation ?? null,
      reviewBuilderMindset: data.builderMindset ?? null,
      reviewCollaboration: data.collaboration ?? null,
      reviewCreativity: data.creativity ?? null,
      reviewDiversity: data.diversity ?? null,
      flagForReview: data.flagForReview,
      reviewNotes: data.reviewComments || null,
      status: data.flagForReview ? "flagged" : "reviewed",
    })
    .where(eq(hackerApplicants.id, applicantId));
};
