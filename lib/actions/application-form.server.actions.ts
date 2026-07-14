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
import { requireSessionUser } from "@/lib/auth/guards";

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
): Promise<{ duplicate: boolean }> => {
  const { id: userId } = await requireSessionUser();
  const parsed = hackerApplicationSchema.parse(data);
  if (parsed.resume !== `resumes/${userId}.pdf`) {
    throw new Error("Invalid resume");
  }

  try {
    const result = await db
      .insert(hackerApplicants)
      .values({ ...toDbValues(parsed), userId })
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
): Promise<void> => {
  const { id: userId } = await requireSessionUser();

  if (data.resume !== undefined && data.resume !== `resumes/${userId}.pdf`) {
    throw new Error("Invalid resume");
  }

  try {
    await db
      .insert(hackerApplicationDrafts)
      .values({ userId, data: data as Record<string, unknown> })
      .onConflictDoUpdate({
        target: hackerApplicationDrafts.userId,
        set: {
          data: data as Record<string, unknown>,
        },
      });
  } catch (error) {
    console.error("Unable to save draft:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save draft",
    );
  }
};
