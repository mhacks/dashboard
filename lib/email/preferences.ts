import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  emailPreferences,
  emailPreferenceSource,
  emailPreferenceStatus,
  type EmailPreferenceRow,
} from "@/lib/db/schema/email";
import { users, type UserEntry } from "@/lib/db/schema/users";

export const optionalEmailTopic = "event-updates";
const emailPublicOrigin =
  process.env.NODE_ENV === "production"
    ? "https://mhacks.org"
    : "http://localhost:3000";

type PreferenceSource = (typeof emailPreferenceSource.enumValues)[number];
type PreferenceStatus = (typeof emailPreferenceStatus.enumValues)[number];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function prepareOptionalEmailDelivery(email: string) {
  const preference = await ensureEmailPreference(email);

  if (preference.status === "unsubscribed") {
    return { suppressed: true as const };
  }

  const signature = signPreferenceId(preference.id);
  return {
    suppressed: false as const,
    footerUrl: preferenceUrl("/email/unsubscribe", preference.id, signature),
    oneClickUrl: preferenceUrl(
      "/api/email/unsubscribe",
      preference.id,
      signature,
    ),
  };
}

export async function getSignedEmailPreference(id: string, signature: string) {
  if (!validPreferenceSignature(id, signature)) return null;

  const [preference] = await db
    .select()
    .from(emailPreferences)
    .where(eq(emailPreferences.id, id))
    .limit(1);

  return preference ?? null;
}

export async function unsubscribeSignedEmailPreference(
  id: string,
  signature: string,
  source: Extract<PreferenceSource, "one_click" | "footer">,
) {
  const preference = await getSignedEmailPreference(id, signature);
  if (!preference) return null;

  if (preference.status === "unsubscribed") return preference;

  const now = new Date().toISOString();
  const [updated] = await db
    .update(emailPreferences)
    .set({
      status: "unsubscribed",
      source,
      unsubscribedAt: now,
      updatedAt: now,
    })
    .where(eq(emailPreferences.id, preference.id))
    .returning();

  return updated ?? preference;
}

export async function getEmailPreferenceForUser(user: UserEntry) {
  return ensureEmailPreference(user.email, user.id, "account");
}

export async function setEmailPreferenceForUser(
  user: UserEntry,
  status: PreferenceStatus,
) {
  const preference = await ensureEmailPreference(
    user.email,
    user.id,
    "account",
  );
  const now = new Date().toISOString();
  const [updated] = await db
    .update(emailPreferences)
    .set({
      status,
      source: "account",
      unsubscribedAt: status === "unsubscribed" ? now : null,
      updatedAt: now,
    })
    .where(eq(emailPreferences.id, preference.id))
    .returning();

  return updated ?? preference;
}

export function maskEmailAddress(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  const hidden = "•".repeat(Math.max(3, local.length - visible.length));
  return `${visible}${hidden}@${domain}`;
}

async function ensureEmailPreference(
  email: string,
  requestedUserId?: string,
  initialSource: Extract<PreferenceSource, "send" | "account"> = "send",
): Promise<EmailPreferenceRow> {
  const normalizedEmail = normalizeEmail(email);

  return db.transaction(async (tx) => {
    let userId = requestedUserId;
    if (!userId) {
      const [matchingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`)
        .limit(1);
      userId = matchingUser?.id;
    }

    const [existing] = await tx
      .select()
      .from(emailPreferences)
      .where(
        and(
          sql`lower(${emailPreferences.email}) = ${normalizedEmail}`,
          eq(emailPreferences.topic, optionalEmailTopic),
        ),
      )
      .limit(1);

    if (existing) {
      if (!existing.userId && userId) {
        const [linked] = await tx
          .update(emailPreferences)
          .set({ userId, updatedAt: new Date().toISOString() })
          .where(eq(emailPreferences.id, existing.id))
          .returning();
        return linked ?? existing;
      }

      return existing;
    }

    const [created] = await tx
      .insert(emailPreferences)
      .values({
        userId,
        email: normalizedEmail,
        topic: optionalEmailTopic,
        status: "subscribed",
        source: initialSource,
      })
      .onConflictDoNothing()
      .returning();

    if (created) return created;

    const [racedPreference] = await tx
      .select()
      .from(emailPreferences)
      .where(
        and(
          sql`lower(${emailPreferences.email}) = ${normalizedEmail}`,
          eq(emailPreferences.topic, optionalEmailTopic),
        ),
      )
      .limit(1);

    if (!racedPreference) {
      throw new Error("Could not create email preference.");
    }

    return racedPreference;
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function preferenceUrl(pathname: string, id: string, signature: string) {
  const url = new URL(pathname, emailPublicOrigin);
  url.searchParams.set("id", id);
  url.searchParams.set("sig", signature);
  return url.toString();
}

function signPreferenceId(id: string) {
  return createHmac("sha256", unsubscribeSecret())
    .update(`v1:${id}`)
    .digest("base64url");
}

function validPreferenceSignature(id: string, signature: string) {
  if (!uuidPattern.test(id) || !signature) return false;

  const expected = Buffer.from(signPreferenceId(id));
  const provided = Buffer.from(signature);
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

function unsubscribeSecret() {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV !== "production") {
    return secret || "mhacks-local-email-unsubscribe-secret";
  }

  throw new Error(
    "EMAIL_UNSUBSCRIBE_SECRET must be configured with at least 32 characters.",
  );
}
