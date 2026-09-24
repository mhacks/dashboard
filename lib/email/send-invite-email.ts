import { sendEmail } from "@/lib/aws/ses";
import { buildApplicationInvitationEmail } from "@/lib/email/application-invite-template";
import {
  buildInviteEmail,
  buildRoleChangeEmail,
} from "@/lib/email/invite-template";
import { buildTeamInviteEmail } from "@/lib/email/team-invite-template";
import type { InvitableUserRole } from "@/lib/types/user-invitations";
import { getRequestOrigin } from "@/lib/url/request-origin";

function inviteLoginUrl(origin: string, email: string, next?: string) {
  const params = new URLSearchParams({
    email,
    utm_source: "invite",
  });
  if (next) params.set("next", next);
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
  await sendEmail({ to, subject, text, html });
}

export async function sendInviteEmail(
  email: string,
  role: InvitableUserRole,
  expiresAt: Date,
) {
  const origin = await getRequestOrigin();
  const loginUrl = inviteLoginUrl(origin, email);
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
  const loginUrl = inviteLoginUrl(origin, email);
  const { subject, text, html } = buildRoleChangeEmail({ role, loginUrl });

  await sendOrThrow({ to: email, subject, text, html });
}

export async function sendApplicationInvitationEmail(
  email: string,
  expiresAt: Date,
) {
  const origin = await getRequestOrigin();
  const applicationUrl = inviteLoginUrl(origin, email, "/apply");
  const { subject, text, html } = buildApplicationInvitationEmail({
    applicationUrl,
    expiresAt,
  });

  await sendOrThrow({ to: email, subject, text, html });
}

export async function sendTeamInviteEmail({
  email,
  teamName,
  inviterName,
}: {
  email: string;
  teamName: string;
  inviterName: string;
}) {
  const origin = await getRequestOrigin();
  const teamUrl = `${origin}/dashboard/team`;
  const { subject, text, html } = await buildTeamInviteEmail({
    teamName,
    inviterName,
    teamUrl,
  });

  await sendOrThrow({ to: email, subject, text, html });
}
