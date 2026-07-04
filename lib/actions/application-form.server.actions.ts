"use server";
import {
  HackerApplicationFormData,
  hackerApplicationSchema,
} from "@/lib/types/applications";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  hackerApplicants,
  hackerApplicationDrafts,
} from "@/lib/db/schema/applications";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user.id;
}

// The MLH agreement checkboxes are validated in the form but not stored —
// submitting the application implies acceptance — so drop them before writing.
type ApplicationDbValues = Omit<
  HackerApplicationFormData,
  "mlhCodeOfConduct" | "mlhPrivacyPolicy" | "mlhEmails"
>;

function toDbValues(parsed: HackerApplicationFormData): ApplicationDbValues {
  const values = { ...parsed };
  delete (values as Partial<HackerApplicationFormData>).mlhCodeOfConduct;
  delete (values as Partial<HackerApplicationFormData>).mlhPrivacyPolicy;
  delete (values as Partial<HackerApplicationFormData>).mlhEmails;
  return values;
}

export const submitHackerApplication = async (
  data: HackerApplicationFormData,
  updatedAt: string,
): Promise<{ duplicate: boolean }> => {
  const userId = await getAuthenticatedUserId();
  const parsed = hackerApplicationSchema.parse(data);

  try {
    const result = await db
      .insert(hackerApplicants)
      .values({ ...toDbValues(parsed), userId, updatedAt })
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
    throw new Error(
      error instanceof Error ? error.message : "Failed to submit application",
    );
  }
};

export const saveDraft = async (
  data: Partial<HackerApplicationFormData>,
  updatedAt: string,
): Promise<void> => {
  const userId = await getAuthenticatedUserId();

  try {
    await db
      .insert(hackerApplicationDrafts)
      .values({ userId, data: data as Record<string, unknown>, updatedAt })
      .onConflictDoUpdate({
        target: hackerApplicationDrafts.userId,
        set: {
          data: data as Record<string, unknown>,
          updatedAt,
        },
      });
  } catch (error) {
    console.error("Unable to save draft:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save draft",
    );
  }
};

export const updateHackerApplication = async (
  data: HackerApplicationFormData,
  updatedAt: string,
): Promise<void> => {
  const userId = await getAuthenticatedUserId();
  const parsed = hackerApplicationSchema.parse(data);

  try {
    await db
      .update(hackerApplicants)
      .set({ ...toDbValues(parsed), updatedAt })
      .where(eq(hackerApplicants.userId, userId));
  } catch (error) {
    console.error("Unable to update Hacker Application:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to update application",
    );
  }
};
