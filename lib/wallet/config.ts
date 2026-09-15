import "server-only";

import { z } from "zod";

/**
 * Apple Wallet signing material. The PEMs are stored base64-encoded so each
 * one fits in a single SSM parameter / .env line:
 *
 *   base64 -i signerCert.pem | tr -d '\n'
 */
const walletEnvSchema = z.object({
  APPLE_WALLET_PASS_TYPE_ID: z.string().min(1),
  APPLE_WALLET_TEAM_ID: z.string().min(1),
  APPLE_WALLET_SIGNER_CERT: z.string().min(1),
  APPLE_WALLET_SIGNER_KEY: z.string().min(1),
  APPLE_WALLET_SIGNER_KEY_PASSPHRASE: z.string().optional(),
  APPLE_WALLET_WWDR_CERT: z.string().min(1),
  WALLET_LINK_SECRET: z.string().min(32),
});

export type WalletConfig = {
  passTypeIdentifier: string;
  teamIdentifier: string;
  certificates: {
    signerCert: string;
    signerKey: string;
    signerKeyPassphrase?: string;
    wwdr: string;
  };
  linkSecret: string;
};

function decodePem(value: string) {
  return Buffer.from(value, "base64").toString("utf8");
}

let cached: WalletConfig | null = null;

/** Throws when any Wallet variable is missing — callers gate on isWalletConfigured(). */
export function getWalletConfig(): WalletConfig {
  if (cached) return cached;

  const parsed = walletEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(
      `Apple Wallet is not configured. Check: ${missing.join(", ")}`,
    );
  }

  const env = parsed.data;
  const signerKey = decodePem(env.APPLE_WALLET_SIGNER_KEY);

  // node-forge fails on an encrypted key without a passphrase with a bare
  // "Cannot read properties of undefined (reading 'length')" at signing time.
  if (
    signerKey.includes("ENCRYPTED") &&
    !env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE
  ) {
    throw new Error(
      "APPLE_WALLET_SIGNER_KEY is encrypted. Set APPLE_WALLET_SIGNER_KEY_PASSPHRASE, or store an unencrypted key (openssl pkey -in key.pem -out signerKey.pem).",
    );
  }

  cached = {
    passTypeIdentifier: env.APPLE_WALLET_PASS_TYPE_ID,
    teamIdentifier: env.APPLE_WALLET_TEAM_ID,
    certificates: {
      signerCert: decodePem(env.APPLE_WALLET_SIGNER_CERT),
      signerKey,
      signerKeyPassphrase: env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE || undefined,
      wwdr: decodePem(env.APPLE_WALLET_WWDR_CERT),
    },
    linkSecret: env.WALLET_LINK_SECRET,
  };
  return cached;
}

/**
 * Environments without certificates (most local setups) hide every Wallet
 * entry point rather than offering a button that can only fail.
 */
export function isWalletConfigured() {
  return walletEnvSchema.safeParse(process.env).success;
}
