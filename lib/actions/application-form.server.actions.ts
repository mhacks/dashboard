"use server";
import {
  HackerApplicationFormData,
  JudgeApplicationFormData,
} from "@/lib/types/applications";
import { db } from "@/lib/db";
import {
  hackerApplicants,
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

    return { duplicate: result.length === 0 };
  } catch (error) {
    console.error("Unable to submit Hacker Application:", error);
    throw error;
  }
};

export const updateHackerApplication = async () => {};

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
