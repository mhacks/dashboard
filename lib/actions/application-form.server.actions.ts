"use server";
import { HackerApplicationFormData } from "@/lib/types/applications";
import { requireSessionUser } from "@/lib/auth/guards";
import {
  submitHackerApplicationForUser,
  saveDraftForUser,
} from "@/lib/actions/application-form.actions";

export const submitHackerApplication = async (
  data: HackerApplicationFormData,
): Promise<{ duplicate: boolean }> => {
  const { id: userId } = await requireSessionUser();

  try {
    return await submitHackerApplicationForUser(userId, data, "web");
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
  const { id: userId } = await requireSessionUser();

  try {
    await saveDraftForUser(userId, data);
  } catch (error) {
    console.error("Unable to save draft:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save draft",
    );
  }
};
