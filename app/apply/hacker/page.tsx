import { Suspense } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import ApplyPage from "./application-form";
import ApplicationFormSkeleton from "./application-form-skeleton";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";

export default async function ApplicationFormPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const userId = user.id;

  let existingApp = null;
  try {
    const existing = await db
      .select()
      .from(hackerApplicants)
      .where(eq(hackerApplicants.userId, userId))
      .limit(1);
    existingApp = existing[0] ?? null;
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err) : err;
    console.error("[DB] hacker_applicants query failed:", cause);
  }

  return (
    <Suspense fallback={<ApplicationFormSkeleton />}>
      <ApplyPage
        userId={userId}
        existingData={existingApp}
      />
    </Suspense>
  );
}
