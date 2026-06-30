"use server";
import {
  HackerApplicationFormData,
  JudgeApplicationFormData,
  hackerApplicationSchema,
  judgeApplicationSchema,
} from "@/lib/types/applications";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  hackerApplicants,
  judgeApplicants,
} from "@/lib/db/schema/applications";
import { createClient } from "@/lib/supabase/server";
import {
  submitHackerApplicationForUser,
  saveDraftForUser,
  toDbValues,
} from "@/lib/actions/application-form.actions";

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user.id;
}

export const submitHackerApplication = async (
  data: HackerApplicationFormData,
): Promise<{ duplicate: boolean }> => {
  const userId = await getAuthenticatedUserId();

  try {
    return await submitHackerApplicationForUser(userId, data);
  } catch (error) {
    console.error("Unable to submit Hacker Application:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to submit application",
    );
  }
};

export const saveDraft = async (
  data: Partial<HackerApplicationFormData>,
): Promise<void> => {
  const userId = await getAuthenticatedUserId();

  try {
    await saveDraftForUser(userId, data);
  } catch (error) {
    console.error("Unable to save draft:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save draft",
    );
  }
};

export const updateHackerApplication = async (
  data: HackerApplicationFormData,
): Promise<void> => {
  const userId = await getAuthenticatedUserId();
  const parsed = hackerApplicationSchema.parse(data);

  try {
    await db
      .update(hackerApplicants)
      .set({ ...toDbValues(parsed) })
      .where(eq(hackerApplicants.userId, userId));
  } catch (error) {
    console.error("Unable to update Hacker Application:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to update application",
    );
  }
};

export const updateJudgeApplications = async (
  data: JudgeApplicationFormData,
) => {
  const userId = await getAuthenticatedUserId();
  const parsed = judgeApplicationSchema.parse(data);

  try {
    await db.insert(judgeApplicants).values({
      ...toDbValues(parsed),
      userId,
    });
  } catch (error) {
    console.error("Unable to update Judge Applications");
    throw error;
  }
};
