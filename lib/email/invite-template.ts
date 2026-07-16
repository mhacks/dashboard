import type { UserRole } from "@/lib/db/schema/users";
import { USER_ROLE_LABELS } from "@/lib/types/user-invitations";

const EMAIL_FONT =
  "font-family: &quot;Red Hat Display&quot;, Arial, sans-serif;";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmailSection(
  content: string,
  {
    align,
    padding = "0 40px 32px",
  }: { align?: "center"; padding?: string } = {},
) {
  return `<tr>
              <td
                ${align ? `align="${align}"` : ""}
                style="
                  padding: ${padding};
                  ${EMAIL_FONT}
                "
              >
                ${content}
              </td>
            </tr>`;
}

function renderSignInButton(loginUrl: string, withLinkCopy = false) {
  const safeLoginUrl = escapeHtml(loginUrl);
  const linkCopy = withLinkCopy
    ? `<p
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
                </p>`
    : "";

  return `<a
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
                  Sign in to MHacks
                </a>${linkCopy}`;
}

function renderWhatsNextSection(items: string[], withContact = false) {
  const contact = withContact
    ? `<p
                  style="
                    margin: 0 0 16px;
                    color: #505050;
                    font-size: 16px;
                    line-height: 1.6;
                  "
                >
                  Questions? Reach out to us anytime at
                  <a
                    href="mailto:hackathon@mhacks.org"
                    style="color: #4285f4; text-decoration: underline"
                  >
                    hackathon@mhacks.org
                  </a>.
                </p>`
    : "";

  return renderEmailSection(
    `<h2
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
                  ${renderListItems(items)}
                </ul>

                ${contact}

                <p
                  style="
                    margin: 0;
                    color: #505050;
                    font-size: 16px;
                    font-weight: 700;
                  "
                >
                  &mdash; The MHacks Team
                </p>`,
    { padding: "0 40px 40px" },
  );
}

function renderEmailLayout(pageTitle: string, bodyRows: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)}</title>
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
      ${EMAIL_FONT}
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
                  src="https://www.mhacks.org/mhacks_logo_green_bg.svg"
                  alt="MHacks"
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
            ${bodyRows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function formatInviteExpiration(expiresAt: Date) {
  return expiresAt.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function roleDescription(role: UserRole) {
  if (role === "organizer") {
    return "You've been invited as an organizer for the MHacks review portal.";
  }

  return "You've been invited to join the MHacks portal as a hacker.";
}

function whatsNextItems(role: UserRole) {
  if (role === "organizer") {
    return [
      "Access the MHacks review portal",
      "Review and manage hacker applications",
      "Collaborate with the organizing team",
    ];
  }

  return [
    "Access your MHacks dashboard",
    "Apply for upcoming hackathons",
    "Manage your profile and applications",
  ];
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
  role: UserRole;
  loginUrl: string;
  expiresAt: Date;
}) {
  const roleLabel = USER_ROLE_LABELS[role];
  const expiration = formatInviteExpiration(expiresAt);
  const nextSteps = whatsNextItems(role);

  const subject = `You're invited to MHacks as ${roleLabel}`;

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
    "Questions? Contact hackathon@mhacks.org.",
    "",
    "— The MHacks Team",
  ].join("\n");

  const html = renderEmailLayout(
    "MHacks | You're Invited",
    `${renderEmailSection(
      `<p
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
                  Join MHacks as ${escapeHtml(roleLabel)}
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
                </p>`,
      { padding: "0 40px" },
    )}
            ${renderEmailSection(
              `<table
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
                </table>`,
              { align: "center", padding: "0 40px 12px" },
            )}
            ${renderEmailSection(renderSignInButton(loginUrl, true), {
              align: "center",
            })}
            ${renderEmailSection(
              `<h2
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
                </p>`,
              { padding: "0 40px 40px" },
            )}
            ${renderWhatsNextSection(nextSteps, true)}`,
  );

  return { subject, text, html };
}

export function buildRoleChangeEmail({
  role,
  loginUrl,
}: {
  role: UserRole;
  loginUrl: string;
}) {
  const roleLabel = USER_ROLE_LABELS[role];
  const nextSteps = whatsNextItems(role);

  const subject = `Your MHacks role has been updated to ${roleLabel}`;

  const text = [
    `Your MHacks portal role has been updated to ${roleLabel}.`,
    "",
    "Sign in to access your updated permissions:",
    loginUrl,
    "",
    "Questions? Contact hackathon@mhacks.org.",
    "",
    "— The MHacks Team",
  ].join("\n");

  const html = renderEmailLayout(
    "MHacks | Role Updated",
    `${renderEmailSection(
      `<p
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
                  Your MHacks portal role has been updated. Sign in to access
                  your updated permissions.
                </p>

                <p style="margin: 0 0 24px; text-align: center">
                  ${renderSignInButton(loginUrl)}
                </p>`,
    )}
            ${renderWhatsNextSection(nextSteps)}`,
  );

  return { subject, text, html };
}
