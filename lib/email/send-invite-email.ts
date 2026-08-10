import { sendEmail } from "@/lib/aws/ses";
import {
  buildInviteEmail,
  buildRoleChangeEmail,
} from "@/lib/email/invite-template";
import type { InvitableUserRole } from "@/lib/types/user-invitations";
import { getRequestOrigin } from "@/lib/url/request-origin";

function inviteLoginUrl(origin: string, email: string, utmSource: string) {
  const params = new URLSearchParams({
    email,
    utm_source: utmSource,
  });
  return `${origin}/login?${params.toString()}`;
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
  role: InvitableUserRole,
  expiresAt: Date,
) {
  const origin = await getRequestOrigin();
  const loginUrl = inviteLoginUrl(origin, email, "team-invite");
  const { subject, text, html } = buildInviteEmail({
    role,
    loginUrl,
    expiresAt,
  });

  await sendOrThrow({ to: email, subject, text, html });
}

export async function sendRoleChangeEmail(
  email: string,
  role: InvitableUserRole,
) {
  const origin = await getRequestOrigin();
  const loginUrl = inviteLoginUrl(origin, email, "team-role-change");
  const { subject, text, html } = buildRoleChangeEmail({ role, loginUrl });

  await sendOrThrow({ to: email, subject, text, html });
}
