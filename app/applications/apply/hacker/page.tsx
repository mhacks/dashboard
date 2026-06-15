import { Suspense } from "react";
import { redirect } from "next/navigation";
import ApplyPage from "./application-form";
import ApplicationFormSkeleton from "./application-form-skeleton";
import { createClient } from "@/lib/supabase/server";

export default function ApplicationForm() {
  const profileIdPromise = getProfileId();

  return (
    <Suspense fallback={<ApplicationFormSkeleton />}>
      <ApplyPage profileIdPromise={profileIdPromise} />
    </Suspense>
  );
}

async function getProfileId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // if (!user) redirect("/login");

  return user ? user.id : "";
}
