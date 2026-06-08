import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link / OTP confirmation endpoint. Supabase emails link here with a
// `token_hash` and `type`; we exchange them for a session, then redirect to
// `next` (defaulting to the home page).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Redirect to the requested page, stripping the auth params.
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Verification failed — send the user to an error page.
  return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
}
