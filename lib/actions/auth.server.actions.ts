"use server";

import { redirect } from "next/navigation";
import { destinationForRole } from "@/lib/auth/redirects";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

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

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
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

  const user = await getSessionUser();
  redirect(destinationForRole(user?.role ?? "hacker", next));
}
