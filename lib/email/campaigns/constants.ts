import "server-only";

/*
  The mandatory test-send recipients.

  Before a campaign can go out to a real list, sendDirectTestEmails must
  deliver successfully to every address here (see direct-service.ts) — it is a
  send gate, not a convenience.

  This used to be a committed array of four named organizers' personal
  @umich.edu addresses. That made the gate expire with the team: a later
  MHacks inherits a hard block pointed at people who have graduated and whose
  mail may bounce, which fails the gate and blocks all sending.

  So it lives in the environment rather than in lib/config/ with the rest of
  the swappable values. These are people, not branding, and they differ per
  deployment — a staging stack should not be gated on the production team's
  inboxes.

  EMAIL_TEST_RECIPIENTS is a comma-separated list. Either form works per
  entry:

      ada@example.edu
      Ada Lovelace <ada@example.edu>

  The second supplies first_name/last_name/name merge data so the test send
  exercises the same merge fields a real campaign uses; the first derives a
  name from the address instead.
*/

export type EmailCampaignTestRecipient = {
  email: string;
  mergeData: Record<string, string>;
};

const ENV_VAR = "EMAIL_TEST_RECIPIENTS";

function parseEntry(raw: string): EmailCampaignTestRecipient | null {
  const entry = raw.trim();
  if (!entry) return null;

  const named = entry.match(/^(.*?)<([^>]+)>$/u);
  const displayName = named?.[1]?.trim() ?? "";
  const email = (named?.[2] ?? entry).trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error(
      `${ENV_VAR} contains an invalid email address: ${JSON.stringify(entry)}`,
    );
  }

  const name = displayName || nameFromEmail(email);
  const [firstName = name, ...rest] = name.split(/\s+/u);

  return {
    email,
    mergeData: {
      first_name: firstName,
      last_name: rest.join(" "),
      name,
    },
  };
}

function nameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  return (
    localPart
      .split(/[._-]+/u)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "There"
  );
}

let cached: readonly EmailCampaignTestRecipient[] | undefined;

/**
 * Throws rather than returning an empty list: an empty list would make
 * sendDirectTestEmails vacuously succeed and hand out a valid send token
 * without a single test email having been delivered, quietly turning the
 * gate off.
 */
export function getRequiredEmailCampaignTestRecipients(): readonly EmailCampaignTestRecipient[] {
  if (cached) return cached;

  const raw = process.env[ENV_VAR];
  if (!raw?.trim()) {
    throw new Error(
      `${ENV_VAR} is not set. Campaign sending requires at least one test recipient — set it to a comma-separated list, e.g. "Ada Lovelace <ada@example.edu>".`,
    );
  }

  const recipients = raw
    .split(",")
    .map(parseEntry)
    .filter((entry): entry is EmailCampaignTestRecipient => entry !== null);

  if (recipients.length === 0) {
    throw new Error(`${ENV_VAR} is set but contains no valid addresses.`);
  }

  cached = recipients;
  return cached;
}
