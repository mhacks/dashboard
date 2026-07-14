"use server";
import {
  HackerApplicationFormData,
  hackerApplicationSchema,
} from "@/lib/types/applications";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { createClient } from "@/lib/supabase/server";
import {
  submitHackerApplicationForUser,
  saveDraftForUser,
  toDbValues,
} from "@/lib/actions/application-form.actions";
import { getPostHogClient } from "@/lib/posthog-server";

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
    const result = await db
      .insert(hackerApplicants)
      .values({ ...toDbValues(parsed), userId })
      .onConflictDoNothing()
      .returning({ id: hackerApplicants.id });

    if (result.length > 0) {
      await db
        .delete(hackerApplicationDrafts)
        .where(eq(hackerApplicationDrafts.userId, userId));

      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: userId,
        event: "application_submitted",
        properties: {
          university: parsed.university,
          degree: parsed.degree,
          graduation_year: parsed.graduationYear,
          transportation_type: parsed.transportationType,
          needs_travel_reimbursement: parsed.needsTravelReimbursement,
        },
      });
      await posthog.flush();
    }

    return { duplicate: result.length === 0 };
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
