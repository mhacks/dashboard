/*
  How the event is reached, and how it identifies itself when it reaches out.

  These were previously spread across lib/aws/ses.ts (the SES from-identity),
  lib/email/assets.ts (socials), lib/decisions.ts (support email),
  lib/landing/nav.ts (the footer mailto), and a handful of inline literals in
  the apply and campaign screens — each with its own copy of the same address.

  See lib/config/event.ts for the naming rationale. Note that the mandatory
  email test recipients are deliberately NOT here: they are people, they
  differ per deployment, and they belong in the environment. See
  lib/email/campaigns/constants.ts.
*/

export const CONTACT = {
  /** Where applicants and attendees are told to write. */
  supportEmail: "hackathon@mhacks.org",

  /**
   * The public site. No trailing slash — callers append their own path.
   *
   * Use the canonical host: the apex 301-redirects to www, and email clients
   * routinely refuse to follow redirects for <img> sources, so a logo served
   * from the apex silently fails to render in some inboxes.
   */
  website: "https://www.mhacks.org",

  /**
   * The SES from-identity. Both are overridable per deployment via EMAIL_FROM
   * and EMAIL_FROM_NAME (see lib/aws/ses.ts) so staging can send from a
   * different verified address; these are the production defaults.
   *
   * fromEmail must be a verified SES identity, or sending fails at runtime.
   */
  fromEmail: "hackathon@mhacks.org",
  fromName: "MHacks Team",

  socials: {
    linkedin: "https://www.linkedin.com/company/mhacks",
    x: "https://x.com/mhacks",
    instagram: "https://www.instagram.com/mhacks_/",
    youtube: "https://www.youtube.com/@mhacks-official",
  },

  /** Handles as displayed next to the links, without the leading @. */
  socialHandles: {
    instagram: "mhacks_",
    x: "mhacks",
  },
} as const;

/** `mailto:` href for the support address. */
export const supportMailto = `mailto:${CONTACT.supportEmail}`;

/** Absolute URL on the public site: websiteUrl("/apply"). */
export function websiteUrl(path = "/"): string {
  return `${CONTACT.website}${path.startsWith("/") ? path : `/${path}`}`;
}
