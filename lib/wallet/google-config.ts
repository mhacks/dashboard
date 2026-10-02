import "server-only";

import { createPrivateKey, type KeyObject } from "node:crypto";

import { z } from "zod";

import { memoizedWalletConfig } from "@/lib/wallet/memoized-config";

/**
 * The downloaded Google Cloud service-account JSON is base64-encoded so it
 * fits safely in one SSM parameter / environment variable:
 *
 *   base64 -i service-account.json | tr -d '\n'
 */
const googleWalletEnvSchema = z.object({
  GOOGLE_WALLET_ISSUER_ID: z.string().regex(/^\d+$/),
  GOOGLE_WALLET_SERVICE_ACCOUNT_KEY: z.string().min(1),
});

const serviceAccountSchema = z.object({
  type: z.literal("service_account"),
  client_email: z.string().email(),
  private_key_id: z.string().min(1),
  private_key: z.string().min(1),
});

export type GoogleWalletConfig = {
  issuerId: string;
  serviceAccountEmail: string;
  privateKeyId: string;
  privateKey: KeyObject;
};

function loadGoogleWalletConfig(): GoogleWalletConfig {
  const parsed = googleWalletEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(
      `Google Wallet is not configured. Check: ${missing.join(", ")}`,
    );
  }

  const encodedCredentials = parsed.data.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY;
  if (encodedCredentials.trimStart().startsWith("{")) {
    throw new Error(
      "GOOGLE_WALLET_SERVICE_ACCOUNT_KEY looks like raw JSON. Store the service-account file base64-encoded.",
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(
      Buffer.from(encodedCredentials, "base64").toString("utf8"),
    );
  } catch (error) {
    throw new Error(
      `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY does not decode to JSON: ${String(error)}`,
    );
  }

  const credentials = serviceAccountSchema.safeParse(decoded);
  if (!credentials.success) {
    throw new Error(
      `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY is not a service-account key: ${z.prettifyError(credentials.error)}`,
    );
  }

  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey(credentials.data.private_key);
  } catch (error) {
    throw new Error(
      `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY contains an invalid private key: ${String(error)}`,
    );
  }

  if (privateKey.asymmetricKeyType !== "rsa") {
    throw new Error(
      "GOOGLE_WALLET_SERVICE_ACCOUNT_KEY must contain an RSA private key.",
    );
  }

  return {
    issuerId: parsed.data.GOOGLE_WALLET_ISSUER_ID,
    serviceAccountEmail: credentials.data.client_email,
    privateKeyId: credentials.data.private_key_id,
    privateKey,
  };
}

const googleWalletConfig = memoizedWalletConfig(
  "Google Wallet",
  Object.keys(googleWalletEnvSchema.shape),
  loadGoogleWalletConfig,
);

export const getGoogleWalletConfig = googleWalletConfig.get;

/** Hide Google Wallet entry points when credentials are absent or invalid. */
export const isGoogleWalletConfigured = googleWalletConfig.isConfigured;
