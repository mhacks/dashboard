import { sendEmail } from "@/lib/aws/ses";
import type { UserRole } from "@/lib/db/schema/users";
import {
  buildInviteEmail,
  buildRoleChangeEmail,
} from "@/lib/email/invite-template";

function getAppUrl() {
  return (
    process.env.APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://mhacks.org"
      : "http://127.0.0.1:3000")
  );
}

async function sendOrThrow({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const sent = await sendEmail({ to, subject, text, html });
  if (!sent) {
    throw new Error("Email is not configured.");
  }
}

export async function sendInviteEmail(
  email: string,
  role: UserRole,
  expiresAt: Date,
) {
  const loginUrl = `${getAppUrl()}/login?email=${encodeURIComponent(email)}`;
  const { subject, text, html } = buildInviteEmail({
    role,
    loginUrl,
    expiresAt,
  });

  await sendOrThrow({ to: email, subject, text, html });
}

export async function sendRoleChangeEmail(email: string, role: UserRole) {
  const loginUrl = `${getAppUrl()}/login?email=${encodeURIComponent(email)}`;
  const { subject, text, html } = buildRoleChangeEmail({ role, loginUrl });

  await sendOrThrow({ to: email, subject, text, html });
}
