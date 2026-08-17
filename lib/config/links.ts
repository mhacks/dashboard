/*
  Every off-site URL the app hands to a user.

  Two kinds of thing live here, and they age differently:

  - MLH policies change rarely, but a new team still has to confirm they're
    pointing at the current season's documents. Having them in one file makes
    that a two-minute review instead of a grep across the apply flow.
  - The waiver, travel guide, and email images are per-year documents. They
    WILL be wrong next year — new Drive files, new content — and each one is a
    link an attendee is asked to read and agree to, so a stale URL here is a
    real problem, not a cosmetic one.

  See lib/config/event.ts for the naming rationale.
*/

import { websiteUrl } from "@/lib/config/contact";

const MLH_POLICIES = "https://github.com/MLH/mlh-policies/blob/main";

export const LINKS = {
  mlh: {
    codeOfConduct: `${MLH_POLICIES}/code-of-conduct.md`,
    privacyPolicy: `${MLH_POLICIES}/privacy-policy.md`,
    contestTerms: `${MLH_POLICIES}/contest-terms.md`,
  },

  /**
   * Per-year documents shown during RSVP. Both are Google Drive links today;
   * both are gates the attendee must open before they can acknowledge, so
   * check these first when setting up a new iteration.
   */
  documents: {
    activitiesWaiver:
      "https://drive.google.com/file/d/1K6OsDr_UCc3lrtSCYjtXt2MIpCwyfWZy/view?usp=sharing",
    travelGuide:
      "https://docs.google.com/document/d/1wYGboHlqKiUywumBq-UM7klsGA3XOtYwYxxxhywLpa4/edit?usp=sharing",
  },
} as const;

/**
 * Images embedded in outgoing email.
 *
 * Email clients will not load an image from a host that redirects, and many
 * will not load one at all without the recipient opting in, so these need to
 * be stable, publicly reachable, and served from the canonical host. The logo
 * comes off the main site; the rest are still Drive-hosted thumbnails pending
 * a move to the site or a CDN.
 */
const driveImage = (fileId: string, width: number) =>
  `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;

export const EMAIL_ASSETS = {
  logo: websiteUrl("/mhacks_logo_green_bg.svg"),
  logoBadge: driveImage("1l-NaSdmxm4a6uhysDS7O2QAPgSxdsZLf", 160),
  flowerDivider: driveImage("1WJrT_P-BZe-zdO_q-Lxk3ghC3nIdXPhf", 900),
  socials: {
    linkedin: driveImage("14fsWSc52IJMFPtyNzM-r0n3esQb2x3kA", 72),
    instagram: driveImage("1F_xnHHxQ0fAjEFMwZWaPWBGCXNGIfPsn", 72),
    youtube: driveImage("1xnKYMWllVHeYE3R6fGGmBdLSfATo7AWi", 72),
    x: driveImage("1yHIHQM9iGCNBI-Jc_JqgC2_jaeIGFhTh", 72),
  },
} as const;
