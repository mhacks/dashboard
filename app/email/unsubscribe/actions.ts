"use server";

import { redirect } from "next/navigation";
import { unsubscribeSignedEmailPreference } from "@/lib/email/preferences";

export async function confirmEmailUnsubscribe(formData: FormData) {
  const id = formData.get("id");
  const signature = formData.get("signature");

  if (typeof id !== "string" || typeof signature !== "string") {
    redirect("/email/unsubscribe?result=invalid");
  }

  const preference = await unsubscribeSignedEmailPreference(
    id,
    signature,
    "footer",
  );

  redirect(
    preference
      ? "/email/unsubscribe?result=unsubscribed"
      : "/email/unsubscribe?result=invalid",
  );
}
