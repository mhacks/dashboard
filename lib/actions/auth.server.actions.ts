"use server";

import { redirect } from "next/navigation";
import { destinationForRole, sanitizeNextPath } from "@/lib/auth/redirects";
import { getSessionUser } from "@/lib/auth/session";
import { acceptPendingUserInvite } from "@/lib/queries/user-invitations";
import { createClient } from "@/lib/supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";

export async function sendOtp(
  email: string,
  turnstileToken: string,
): Promise<{ error: string } | undefined> {
  const secretKey = process.env.LOGIN_TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    return { error: "Server configuration error." };
  }

  const body = new FormData();
  body.append("secret", secretKey);
  body.append("response", turnstileToken);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  const data = (await res.json()) as { success: boolean };
  if (!data.success) {
    return { error: "Security check failed. Please try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    return { error: error.message };
  }
}

/**
 * With `next`, lands on the login page headed back there instead of the home
 * page — for someone signed in as the wrong account mid-flow, like the Discord
 * link page, who needs to sign in again and pick up where they left off.
 */
export async function logout(next?: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const safeNext = sanitizeNextPath(next);
  redirect(safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/");
}

export async function verifyOtp(
  email: string,
  token: string,
  next?: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) return { error: error.message };

  if (data.user) {
    const verifiedEmail = data.user.email ?? email;
    try {
      await acceptPendingUserInvite(data.user.id, verifiedEmail);
    } catch (inviteError) {
      console.error("Unable to accept pending user invite:", inviteError);
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: data.user.id,
      event: "user_signed_in",
      properties: { method: "otp" },
    });
    await posthog.flush();
  }

  const user = await getSessionUser();
  redirect(destinationForRole(user?.role ?? "hacker", next));
}
