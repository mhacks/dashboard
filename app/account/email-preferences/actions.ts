"use server";

import { revalidatePath } from "next/cache";
import { requireSessionUser } from "@/lib/auth/guards";
import { setEmailPreferenceForUser } from "@/lib/email/preferences";

export async function updateOptionalEmailPreference(formData: FormData) {
  const status = formData.get("status");
  if (status !== "subscribed" && status !== "unsubscribed") {
    throw new Error("Invalid email preference.");
  }

  const user = await requireSessionUser();
  await setEmailPreferenceForUser(user, status);
  revalidatePath("/account/email-preferences");
}
