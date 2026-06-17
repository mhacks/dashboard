import { Suspense } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import ApplyPage from "./application-form";
import ApplicationFormSkeleton from "./application-form-skeleton";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { hackerApplicants } from "@/lib/db/schema/applications";
import { MHacksLogo } from "@/components/mhacks-logo";

export default async function ApplicationFormPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // if (!user) redirect("/login");

  const userId = user ? user.id : "";

  if (userId) {
    const existing = await db
      .select({ id: hackerApplicants.id })
      .from(hackerApplicants)
      .where(eq(hackerApplicants.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      return <AlreadyApplied />;
    }
  }

  return (
    <Suspense fallback={<ApplicationFormSkeleton />}>
      <ApplyPage profileIdPromise={Promise.resolve(userId)} />
    </Suspense>
  );
}

function AlreadyApplied() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <MHacksLogo size={48} />
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          MHacks 2026
        </p>
        <h2
          className="mt-3 font-heading italic text-4xl leading-tight tracking-tight"
          style={{ color: "#3A4A26" }}
        >
          Already Applied!
        </h2>
        <p className="mt-4 text-[14px] leading-7 text-zinc-500">
          You&apos;ve already submitted a hacker application for MHacks 2026.
          We&apos;ll be in touch soon with a decision.
        </p>
        <a
          href="/"
          className="mt-8 inline-block rounded-full px-8 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-80"
          style={{ background: "#3A4A26" }}
        >
          Return Home
        </a>
      </div>
    </div>
  );
}
