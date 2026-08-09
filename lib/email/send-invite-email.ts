import { sendEmail } from "@/lib/aws/ses";
import {
  buildInviteEmail,
  buildRoleChangeEmail,
} from "@/lib/email/invite-template";
import type { InvitableUserRole } from "@/lib/types/user-invitations";
import { getRequestOrigin } from "@/lib/url/request-origin";

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
  const loginUrl = `${origin}/login?email=${encodeURIComponent(email)}`;
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
  const loginUrl = `${origin}/login?email=${encodeURIComponent(email)}`;
  const { subject, text, html } = buildRoleChangeEmail({ role, loginUrl });

  await sendOrThrow({ to: email, subject, text, html });
}
