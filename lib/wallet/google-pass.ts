import "server-only";

import { sign } from "node:crypto";

import { z } from "zod";

import {
  WALLET_EVENT,
  WALLET_PASS_COPY,
  walletFallbackText,
} from "@/lib/wallet/event";
import { getGoogleWalletConfig } from "@/lib/wallet/google-config";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_WALLET_API =
  "https://walletobjects.googleapis.com/walletobjects/v1";
const GOOGLE_WALLET_SCOPE =
  "https://www.googleapis.com/auth/wallet_object.issuer";
const GOOGLE_SAVE_URL = "https://pay.google.com/gp/v/save";
const CLASS_SUFFIX = "mhacks_2026";
const EVENT_START = WALLET_EVENT.relevantIntervals[0].startDate;
const EVENT_DATES_FIELD = "class.textModulesData['event_dates']";
const ATTENDEE_FIELD = "object.textModulesData['attendee']";
const GOOGLE_PASS_BACKGROUND = "#f0f7fa";

const accessTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

type CachedAccessToken = { value: string; expiresAt: number };

let cachedAccessToken: CachedAccessToken | null = null;
let accessTokenPromise: Promise<CachedAccessToken> | null = null;
let classPromise: Promise<void> | null = null;

function localized(value: string) {
  return { defaultValue: { language: "en-US", value } };
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** Signs both OAuth assertions and Save-to-Wallet JWTs with RS256. */
function signJwt(claims: Record<string, unknown>) {
  const config = getGoogleWalletConfig();
  const header = encodeJson({
    alg: "RS256",
    typ: "JWT",
    kid: config.privateKeyId,
  });
  const payload = encodeJson(claims);
  const signingInput = `${header}.${payload}`;
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(signingInput),
    config.privateKey,
  ).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function requestAccessToken(): Promise<CachedAccessToken> {
  const config = getGoogleWalletConfig();
  const issuedAt = Math.floor(Date.now() / 1000);
  const assertion = signJwt({
    iss: config.serviceAccountEmail,
    scope: GOOGLE_WALLET_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 60 * 60,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `Google OAuth token request failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
    );
  }

  const token = accessTokenSchema.parse(await response.json());
  return {
    value: token.access_token,
    // Refresh one minute early rather than risk using a token at its boundary.
    expiresAt: Date.now() + (token.expires_in - 60) * 1000,
  };
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.value;
  }

  accessTokenPromise ??= requestAccessToken().finally(() => {
    accessTokenPromise = null;
  });
  cachedAccessToken = await accessTokenPromise;
  return cachedAccessToken.value;
}

async function walletApiRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${GOOGLE_WALLET_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  return response;
}

async function throwApiError(operation: string, response: Response) {
  throw new Error(
    `${operation} failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
  );
}

function googleWalletClass() {
  const { issuerId } = getGoogleWalletConfig();
  const id = `${issuerId}.${CLASS_SUFFIX}`;
  const publicOrigin = WALLET_EVENT.webOrigin;

  return {
    id,
    eventId: id,
    issuerName: "MHacks",
    reviewStatus: "UNDER_REVIEW",
    eventName: localized(WALLET_EVENT.name),
    venue: {
      name: localized(WALLET_EVENT.venueName),
      address: localized(WALLET_EVENT.venueAddress),
    },
    textModulesData: [
      {
        id: "event_dates",
        header: WALLET_PASS_COPY.date.label,
        body: WALLET_PASS_COPY.date.value,
      },
    ],
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            oneItem: {
              item: {
                firstValue: {
                  fields: [{ fieldPath: EVENT_DATES_FIELD }],
                },
              },
            },
          },
          {
            oneItem: {
              item: {
                firstValue: {
                  fields: [{ fieldPath: ATTENDEE_FIELD }],
                },
              },
            },
          },
        ],
      },
      listTemplateOverride: {
        secondRowOption: {
          fields: [{ fieldPath: EVENT_DATES_FIELD }],
        },
      },
    },
    logo: {
      sourceUri: { uri: `${publicOrigin}/wallet/google/logo.png` },
      contentDescription: localized("MHacks logo"),
    },
    heroImage: {
      sourceUri: { uri: `${publicOrigin}/wallet/google/hero.png` },
      contentDescription: localized("MHacks banner artwork"),
    },
    hexBackgroundColor: GOOGLE_PASS_BACKGROUND,
    locations: [{ ...WALLET_EVENT.location }],
  };
}

/**
 * Replaces the resource with `body`, creating it if it doesn't exist yet. An
 * update rather than create-if-missing, so a corrected class or a renamed
 * attendee reaches Google the next time the pass is requested. Unused response
 * bodies are cancelled so their sockets go back to the pool.
 */
async function upsert(resource: string, body: { id: string }, label: string) {
  const payload = JSON.stringify(body);
  const updated = await walletApiRequest(
    `/${resource}/${encodeURIComponent(body.id)}`,
    { method: "PUT", body: payload },
  );
  if (updated.ok) {
    await updated.body?.cancel();
    return;
  }
  if (updated.status !== 404) {
    await throwApiError(`Updating the ${label}`, updated);
  }
  await updated.body?.cancel();

  const created = await walletApiRequest(`/${resource}`, {
    method: "POST",
    body: payload,
  });
  // A concurrent request (or another instance) may have created it first.
  if (!created.ok && created.status !== 409) {
    await throwApiError(`Creating the ${label}`, created);
  }
  await created.body?.cancel();
}

function ensureEventClass() {
  classPromise ??= upsert(
    "eventTicketClass",
    googleWalletClass(),
    "Google Wallet class",
  ).catch((error) => {
    classPromise = null;
    throw error;
  });
  return classPromise;
}

function googleWalletObject({
  userId,
  firstName,
  lastName,
  origin,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  origin: string;
}) {
  const { issuerId } = getGoogleWalletConfig();
  const attendee = [firstName.trim(), lastName.trim()]
    .filter(Boolean)
    .join(" ");

  return {
    id: `${issuerId}.${CLASS_SUFFIX}_${userId}`,
    classId: `${issuerId}.${CLASS_SUFFIX}`,
    state: "ACTIVE",
    ticketHolderName: attendee || WALLET_PASS_COPY.attendee.fallback,
    barcode: { type: "QR_CODE", value: userId },
    hexBackgroundColor: GOOGLE_PASS_BACKGROUND,
    // Expires with the Apple pass and the emailed links, not when the last
    // day's relevant interval does.
    validTimeInterval: {
      start: { date: EVENT_START },
      end: { date: WALLET_EVENT.endsAt },
    },
    locations: [{ ...WALLET_EVENT.location }],
    textModulesData: [
      {
        id: "attendee",
        header: WALLET_PASS_COPY.attendee.label,
        body: attendee || WALLET_PASS_COPY.attendee.fallback,
      },
      {
        id: "check_in",
        header: WALLET_PASS_COPY.checkingIn.label,
        body: WALLET_PASS_COPY.checkingIn.value,
      },
      {
        id: "venue",
        header: WALLET_PASS_COPY.venue.label,
        body: WALLET_PASS_COPY.venue.value,
      },
      {
        id: "fallback_text",
        header: WALLET_PASS_COPY.fallbackLabel,
        body: walletFallbackText(origin),
      },
    ],
    linksModuleData: {
      uris: [
        {
          id: "handbook",
          uri: WALLET_PASS_COPY.handbook.value,
          description: WALLET_PASS_COPY.handbook.label,
        },
        {
          id: "website",
          uri: WALLET_PASS_COPY.website.value,
          description: WALLET_PASS_COPY.website.label,
        },
        {
          id: "fallback",
          uri: `${origin}/dashboard/qr`,
          description: WALLET_PASS_COPY.fallbackLabel,
        },
        {
          id: "support",
          uri: `mailto:${WALLET_PASS_COPY.support.value}`,
          description: WALLET_PASS_COPY.support.label,
        },
      ],
    },
  };
}

/**
 * Creates or updates the issuer-owned class/object, then signs a short JWT that
 * tells Google which existing object to save. Keeping the full pass out of the
 * JWT avoids browsers truncating Save-to-Wallet URLs over Google's safe limit.
 */
export async function buildGoogleWalletSaveUrl({
  userId,
  firstName,
  lastName,
  origin,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  origin: string;
}) {
  await ensureEventClass();
  const object = googleWalletObject({ userId, firstName, lastName, origin });
  await upsert("eventTicketObject", object, "Google Wallet pass");

  const config = getGoogleWalletConfig();
  const token = signJwt({
    iss: config.serviceAccountEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [origin],
    payload: { eventTicketObjects: [{ id: object.id }] },
  });

  return `${GOOGLE_SAVE_URL}/${token}`;
}
