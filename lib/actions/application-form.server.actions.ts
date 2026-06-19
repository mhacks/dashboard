"use server";
import {
  HackerApplicationFormData,
  JudgeApplicationFormData,
} from "@/lib/types/applications";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  hackerApplicants,
  hackerApplicationDrafts,
  judgeApplicants,
} from "@/lib/db/schema/applications";

export const submitHackerApplication = async (
  userId: string,
  data: HackerApplicationFormData,
): Promise<{ duplicate: boolean }> => {
  try {
    const result = await db
      .insert(hackerApplicants)
      .values({ ...data, userId })
      .onConflictDoNothing()
      .returning({ id: hackerApplicants.id });

    if (result.length > 0) {
      await db
        .delete(hackerApplicationDrafts)
        .where(eq(hackerApplicationDrafts.userId, userId));
    }

    return { duplicate: result.length === 0 };
  } catch (error) {
    console.error("Unable to submit Hacker Application:", error);
    throw error;
  }
};

export const saveDraft = async (
  userId: string,
  data: Partial<HackerApplicationFormData>,
): Promise<void> => {
  try {
    await db
      .insert(hackerApplicationDrafts)
      .values({ userId, data: data as Record<string, unknown> })
      .onConflictDoUpdate({
        target: hackerApplicationDrafts.userId,
        set: { data: data as Record<string, unknown>, updatedAt: new Date() },
      });
  } catch (error) {
    console.error("Unable to save draft:", error);
    throw error;
  }
};

export const updateHackerApplication = async (
  userId: string,
  data: HackerApplicationFormData,
): Promise<void> => {
  try {
    await db
      .update(hackerApplicants)
      .set({ ...data })
      .where(eq(hackerApplicants.userId, userId));
  } catch (error) {
    console.error("Unable to update Hacker Application:", error);
    throw error;
  }
};

export const updateJudgeApplications = async (
  userId: string,
  data: JudgeApplicationFormData,
) => {
  try {
    await db.insert(judgeApplicants).values({
      ...data,
      userId: userId,
    });
  } catch (error) {
    console.error("Unable to update Judge Applications");
    throw error;
  }
};
