import { formatInviteExpiration } from "@/lib/email/invite-template";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildApplicationInvitationEmail({
  applicationUrl,
  expiresAt,
}: {
  applicationUrl: string;
  expiresAt: Date;
}) {
  const expiration = formatInviteExpiration(expiresAt);
  const safeApplicationUrl = escapeHtml(applicationUrl);
  const subject = "You're invited to apply to MHacks 2026";
  const text = [
    "The MHacks team has opened a private application window for you.",
    "",
    "Sign in with this email address and complete your application:",
    applicationUrl,
    "",
    `Your private application window closes on ${expiration}.`,
    "",
    "Questions? Contact hackathon@mhacks.org.",
    "",
    "— The MHacks Team",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MHacks | Application Invitation</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f1de;font-family:Arial,sans-serif;color:#040404">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 16px;background:#f6f1de">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;overflow:hidden;border-radius:16px;background:#ffffff">
            <tr>
              <td style="padding:40px">
                <p style="margin:0 0 12px;color:#69a13b;font-size:14px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Private invitation</p>
                <h1 style="margin:0 0 20px;font-size:32px;line-height:1.2">Apply to MHacks 2026</h1>
                <p style="margin:0 0 24px;color:#505050;font-size:16px;line-height:1.6">The MHacks team has opened a private application window for you. Sign in using this email address to start or finish your application.</p>
                <a href="${safeApplicationUrl}" style="display:inline-block;border-radius:999px;background:#3a4a26;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px">Start your application</a>
                <p style="margin:24px 0 0;color:#505050;font-size:15px;line-height:1.6">This private window closes on <strong style="color:#040404">${escapeHtml(expiration)}</strong>.</p>
                <p style="margin:16px 0 0;color:#707070;font-size:13px;line-height:1.5">Or copy this link into your browser:<br /><a href="${safeApplicationUrl}" style="color:#4285f4;word-break:break-all">${safeApplicationUrl}</a></p>
                <p style="margin:28px 0 0;color:#505050;font-size:15px;line-height:1.6">Questions? Email <a href="mailto:hackathon@mhacks.org" style="color:#4285f4">hackathon@mhacks.org</a>.</p>
                <p style="margin:16px 0 0;font-weight:700">&mdash; The MHacks Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
