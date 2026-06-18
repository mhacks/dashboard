"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function sendOtp(
  email: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { error: error.message };
}

export async function verifyOtp(
  email: string,
  token: string,
  next?: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) return { error: error.message };

  // Only allow relative same-origin paths; reject anything else.
  const destination =
    next && next.startsWith("/") && !next.startsWith("/auth") ? next : "/";
  redirect(destination);
}
