import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/aws/ses";
import type { UserRole } from "@/lib/db/schema/users";

function getAppUrl() {
  return (
    process.env.APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://mhacks.org"
      : "http://127.0.0.1:3000")
  );
}

function inviteCopy(role: UserRole, loginUrl: string) {
  const roleLine =
    role === "organizer"
      ? "You've been invited as an organizer for the MHacks review portal."
      : "You've been invited to MHacks.";

  const text = `${roleLine}\n\nSign in with this email within 7 days:\n${loginUrl}`;

  const html = `<p>${roleLine}</p><p>This invite expires in 7 days.</p><p><a href="${loginUrl}">Sign in to MHacks</a></p>`;

  return { subject: "You're invited to MHacks", text, html };
}

async function sendViaAuthOtp(email: string) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Email is not configured.");
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { error } = await admin.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendInviteEmail(email: string, role: UserRole) {
  const loginUrl = `${getAppUrl()}/login?email=${encodeURIComponent(email)}`;
  const { subject, text, html } = inviteCopy(role, loginUrl);

  const sent = await sendEmail({ to: email, subject, text, html });
  if (sent) return;

  await sendViaAuthOtp(email);
}
