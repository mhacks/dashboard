import {
  HackerApplicationFormData,
  hackerApplicationSchema,
} from "@/lib/types/applications";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  hackerApplicants,
  hackerApplicationDrafts,
  type HackerApplicantRow,
} from "@/lib/db/schema/applications";

// Core application logic, parameterized by `userId`, shared by both the web
// form (cookie-authenticated server actions) and the MCP server (OAuth
// token-authenticated tools). Keeping the Zod validation + Drizzle writes here
// guarantees both entry points go through the exact same rules — the MCP path
// can never persist data the form would have rejected.

// The MLH agreement checkboxes are validated in the form but not stored —
// submitting the application implies acceptance — so drop them before writing.
export type ApplicationDbValues = Omit<
  HackerApplicationFormData,
  "mlhCodeOfConduct" | "mlhPrivacyPolicy" | "mlhEmails"
>;

export function toDbValues(
  parsed: HackerApplicationFormData,
): ApplicationDbValues {
  const values = { ...parsed };
  delete (values as Partial<HackerApplicationFormData>).mlhCodeOfConduct;
  delete (values as Partial<HackerApplicationFormData>).mlhPrivacyPolicy;
  delete (values as Partial<HackerApplicationFormData>).mlhEmails;
  return values;
}

export async function submitHackerApplicationForUser(
  userId: string,
  data: HackerApplicationFormData,
): Promise<{ duplicate: boolean }> {
  const parsed = hackerApplicationSchema.parse(data);

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
}

export async function saveDraftForUser(
  userId: string,
  data: Partial<HackerApplicationFormData>,
): Promise<void> {
  await db
    .insert(hackerApplicationDrafts)
    .values({ userId, data: data as Record<string, unknown> })
    .onConflictDoUpdate({
      target: hackerApplicationDrafts.userId,
      set: {
        data: data as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });
}

export async function getApplicationStatusForUser(
  userId: string,
): Promise<HackerApplicantRow | null> {
  const rows = await db
    .select()
    .from(hackerApplicants)
    .where(eq(hackerApplicants.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}
