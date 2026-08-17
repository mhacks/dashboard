import { formatLongDateTimeWithZone } from "@/lib/format/date";
import { userRoleLabel } from "@/lib/display/user-roles";
import type { InvitableUserRole } from "@/lib/types/user-invitations";
import { EVENT } from "@/lib/config/event";
import { CONTACT, supportMailto } from "@/lib/config/contact";
import { EMAIL_ASSETS } from "@/lib/config/links";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatInviteExpiration(expiresAt: Date) {
  return formatLongDateTimeWithZone(expiresAt);
}

const ROLE_INVITE_CONTENT: Record<
  InvitableUserRole,
  { description: string; nextSteps: string[] }
> = {
  hacker: {
    description: `You've been invited to join the ${EVENT.name} portal as a hacker.`,
    nextSteps: [
      `Access your ${EVENT.name} dashboard`,
      "Apply for upcoming hackathons",
      "Manage your profile and applications",
    ],
  },
  organizer: {
    description: `You've been invited as an organizer for the ${EVENT.name} review portal.`,
    nextSteps: [
      `Access the ${EVENT.name} review portal`,
      "Review and manage hacker applications",
      "Collaborate with the organizing team",
    ],
  },
  volunteer: {
    description: `You've been invited as a volunteer for the ${EVENT.name} portal.`,
    nextSteps: [
      `Access the ${EVENT.name} portal`,
      `Support event operations during ${EVENT.name}`,
      "Coordinate with the organizing team",
    ],
  },
  judge: {
    description: `You've been invited as a judge for the ${EVENT.name} portal.`,
    nextSteps: [
      `Access the ${EVENT.name} portal`,
      "Review and score hackathon projects",
      "Collaborate with organizers and other judges",
    ],
  },
};

function roleDescription(role: InvitableUserRole) {
  return ROLE_INVITE_CONTENT[role].description;
}

function whatsNextItems(role: InvitableUserRole) {
  return ROLE_INVITE_CONTENT[role].nextSteps;
}

function renderListItems(items: string[]) {
  return items
    .map(
      (item, index) =>
        `<li style="margin-bottom: ${index === items.length - 1 ? 0 : 4}px">${escapeHtml(item)}</li>`,
    )
    .join("");
}

export function buildInviteEmail({
  role,
  loginUrl,
  expiresAt,
}: {
  role: InvitableUserRole;
  loginUrl: string;
  expiresAt: Date;
}) {
  const roleLabel = userRoleLabel(role);
  const expiration = formatInviteExpiration(expiresAt);
  const safeLoginUrl = escapeHtml(loginUrl);
  const nextSteps = whatsNextItems(role);

  const subject = `You're invited to ${EVENT.name} as ${roleLabel}`;

  const text = [
    roleDescription(role),
    "",
    `Role: ${roleLabel}`,
    "",
    "Sign in with this email address to accept your invite:",
    loginUrl,
    "",
    "How to sign in:",
    "1. Open the link above.",
    "2. Confirm your email address.",
    "3. Enter the 6-digit code we send you.",
    "",
    `This invite expires on ${expiration}.`,
    "",
    `Questions? Contact ${CONTACT.supportEmail}.`,
    "",
    `— The ${EVENT.name} Team`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${EVENT.name} | You're Invited</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;700;800;900&display=swap"
      rel="stylesheet"
    />
    <style>
      body,
      table,
      td,
      a {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      table,
      td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }
      img {
        -ms-interpolation-mode: bicubic;
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
      }
      table {
        border-collapse: collapse !important;
      }
      body {
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
      }
    </style>
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f6f1de;
      font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background-color: #f6f1de; padding: 40px 0; width: 100%"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              max-width: 600px;
            "
          >
            <tr>
              <td align="center" style="padding: 40px 40px 20px">
                <img
                  src="${EMAIL_ASSETS.logo}"
                  alt="${EVENT.name}"
                  width="120"
                  style="
                    display: block;
                    border: 0;
                    width: 120px;
                    max-width: 120px;
                  "
                />
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 0 40px;
                  font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;
                "
              >
                <p
                  style="
                    margin: 0;
                    color: #69a13b;
                    font-size: 18px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                  "
                >
                  You're Invited
                </p>

                <h1
                  style="
                    margin: 16px 0 24px;
                    color: #040404;
                    font-size: 32px;
                    font-weight: 900;
                    line-height: 1.2;
                  "
                >
                  Join ${EVENT.name} as ${escapeHtml(roleLabel)}
                </h1>

                <p
                  style="
                    margin: 0 0 16px;
                    color: #505050;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  ${escapeHtml(roleDescription(role))}
                </p>

                <p
                  style="
                    margin: 0 0 32px;
                    color: #505050;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  Sign in with this email address to accept your invite and
                  access the portal.
                </p>
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="
                  padding: 0 40px 12px;
                  font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;
                "
              >
                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  style="
                    background: #f4f4f4;
                    border-radius: 12px;
                    width: 100%;
                    max-width: 320px;
                  "
                >
                  <tr>
                    <td align="center" style="padding: 20px 24px">
                      <p
                        style="
                          margin: 0 0 8px;
                          color: #707070;
                          font-size: 13px;
                          font-weight: 700;
                          letter-spacing: 1px;
                          text-transform: uppercase;
                        "
                      >
                        Assigned role
                      </p>
                      <p
                        style="
                          margin: 0;
                          color: #040404;
                          font-size: 28px;
                          font-weight: 900;
                          line-height: 1.2;
                        "
                      >
                        ${escapeHtml(roleLabel)}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                align="center"
                style="
                  padding: 0 40px 32px;
                  font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;
                "
              >
                <a
                  href="${safeLoginUrl}"
                  style="
                    display: inline-block;
                    background: #3a4a26;
                    color: #ffffff;
                    font-size: 16px;
                    font-weight: 700;
                    line-height: 1;
                    text-decoration: none;
                    border-radius: 999px;
                    padding: 14px 28px;
                  "
                >
                  Sign in to ${EVENT.name}
                </a>
                <p
                  style="
                    margin: 16px 0 0;
                    color: #707070;
                    font-size: 13px;
                    line-height: 1.5;
                  "
                >
                  Or copy this link into your browser:<br />
                  <a
                    href="${safeLoginUrl}"
                    style="color: #4285f4; text-decoration: underline; word-break: break-all"
                  >
                    ${safeLoginUrl}
                  </a>
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 0 40px 40px;
                  font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;
                "
              >
                <h2
                  style="
                    margin: 0 0 20px;
                    color: #040404;
                    font-size: 24px;
                    font-weight: 900;
                  "
                >
                  How to sign in
                </h2>

                <ol
                  style="
                    margin: 0 0 24px;
                    padding-left: 20px;
                    color: #505050;
                    font-size: 16px;
                    line-height: 1.8;
                  "
                >
                  <li style="margin-bottom: 4px">
                    Open the sign-in link above.
                  </li>
                  <li style="margin-bottom: 4px">
                    Confirm your email address.
                  </li>
                  <li style="margin-bottom: 0">
                    Enter the 6-digit code we email you to finish signing in.
                  </li>
                </ol>

                <p
                  style="
                    margin: 0;
                    color: #505050;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  This invite expires on
                  <strong style="color: #040404">${escapeHtml(expiration)}</strong>.
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 0 40px 40px;
                  font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;
                "
              >
                <h2
                  style="
                    margin: 0 0 20px;
                    color: #040404;
                    font-size: 24px;
                    font-weight: 900;
                  "
                >
                  What's Next?
                </h2>

                <ul
                  style="
                    margin: 0 0 24px;
                    padding-left: 20px;
                    color: #505050;
                    font-size: 16px;
                    line-height: 1.8;
                  "
                >
                  ${renderListItems(nextSteps)}
                </ul>

                <p
                  style="
                    margin: 0 0 16px;
                    color: #505050;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  Questions? Reach out to us anytime at
                  <a
                    href="${supportMailto}"
                    style="color: #4285f4; text-decoration: underline"
                  >
                    ${CONTACT.supportEmail}
                  </a>.
                </p>

                <p
                  style="
                    margin: 0;
                    color: #505050;
                    font-size: 16px;
                    font-weight: 700;
                  "
                >
                  &mdash; The ${EVENT.name} Team
                </p>
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

export function buildRoleChangeEmail({
  role,
  loginUrl,
}: {
  role: InvitableUserRole;
  loginUrl: string;
}) {
  const roleLabel = userRoleLabel(role);
  const safeLoginUrl = escapeHtml(loginUrl);
  const nextSteps = whatsNextItems(role);

  const subject = `Your ${EVENT.name} role has been updated to ${roleLabel}`;

  const text = [
    `Your ${EVENT.name} portal role has been updated to ${roleLabel}.`,
    "",
    "Sign in to access your updated permissions:",
    loginUrl,
    "",
    `Questions? Contact ${CONTACT.supportEmail}.`,
    "",
    `— The ${EVENT.name} Team`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${EVENT.name} | Role Updated</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;700;800;900&display=swap"
      rel="stylesheet"
    />
    <style>
      body,
      table,
      td,
      a {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      table,
      td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }
      img {
        -ms-interpolation-mode: bicubic;
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
      }
      table {
        border-collapse: collapse !important;
      }
      body {
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
      }
    </style>
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f6f1de;
      font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="background-color: #f6f1de; padding: 40px 0; width: 100%"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              max-width: 600px;
            "
          >
            <tr>
              <td align="center" style="padding: 40px 40px 20px">
                <img
                  src="${EMAIL_ASSETS.logo}"
                  alt="${EVENT.name}"
                  width="120"
                  style="
                    display: block;
                    border: 0;
                    width: 120px;
                    max-width: 120px;
                  "
                />
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 0 40px 32px;
                  font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;
                "
              >
                <p
                  style="
                    margin: 0;
                    color: #69a13b;
                    font-size: 18px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                  "
                >
                  Role Updated
                </p>

                <h1
                  style="
                    margin: 16px 0 24px;
                    color: #040404;
                    font-size: 32px;
                    font-weight: 900;
                    line-height: 1.2;
                  "
                >
                  You're now ${escapeHtml(roleLabel)}
                </h1>

                <p
                  style="
                    margin: 0 0 32px;
                    color: #505050;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  Your ${EVENT.name} portal role has been updated. Sign in to access
                  your updated permissions.
                </p>

                <p style="margin: 0 0 24px; text-align: center">
                  <a
                    href="${safeLoginUrl}"
                    style="
                      display: inline-block;
                      background: #3a4a26;
                      color: #ffffff;
                      font-size: 16px;
                      font-weight: 700;
                      line-height: 1;
                      text-decoration: none;
                      border-radius: 999px;
                      padding: 14px 28px;
                    "
                  >
                    Sign in to ${EVENT.name}
                  </a>
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding: 0 40px 40px;
                  font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;
                "
              >
                <h2
                  style="
                    margin: 0 0 20px;
                    color: #040404;
                    font-size: 24px;
                    font-weight: 900;
                  "
                >
                  What's Next?
                </h2>

                <ul
                  style="
                    margin: 0 0 24px;
                    padding-left: 20px;
                    color: #505050;
                    font-size: 16px;
                    line-height: 1.8;
                  "
                >
                  ${renderListItems(nextSteps)}
                </ul>

                <p
                  style="
                    margin: 0;
                    color: #505050;
                    font-size: 16px;
                    font-weight: 700;
                  "
                >
                  &mdash; The ${EVENT.name} Team
                </p>
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
