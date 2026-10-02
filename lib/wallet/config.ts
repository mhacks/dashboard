import "server-only";

import { createPrivateKey, X509Certificate } from "node:crypto";
import { z } from "zod";

import { memoizedWalletConfig } from "@/lib/wallet/memoized-config";

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
});

export type AppleWalletConfig = {
  passTypeIdentifier: string;
  teamIdentifier: string;
  certificates: {
    signerCert: string;
    signerKey: string;
    signerKeyPassphrase?: string;
    wwdr: string;
  };
};

function decodePem(name: string, value: string) {
  // Buffer.from(_, "base64") never throws — it skips invalid characters — so
  // a raw PEM pasted into SSM would otherwise decode to silent garbage.
  if (value.trimStart().startsWith("-----BEGIN")) {
    throw new Error(
      `${name} looks like a raw PEM. Store it base64-encoded: base64 -i file.pem | tr -d '\\n'`,
    );
  }

  const pem = Buffer.from(value, "base64").toString("utf8");
  if (!pem.includes("-----BEGIN")) {
    throw new Error(`${name} does not decode to a PEM.`);
  }
  return pem;
}

function parseCertificate(name: string, value: string) {
  const pem = decodePem(name, value);
  try {
    new X509Certificate(pem);
  } catch (error) {
    throw new Error(`${name} is not a valid certificate: ${String(error)}`);
  }
  return pem;
}

/**
 * Parses and validates every Wallet variable, including that the PEMs decode
 * and the key opens with its passphrase, so a bad value fails here rather than
 * at signing time.
 */
function loadWalletConfig(): AppleWalletConfig {
  const parsed = walletEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(
      `Apple Wallet is not configured. Check: ${missing.join(", ")}`,
    );
  }

  const env = parsed.data;
  const signerKey = decodePem(
    "APPLE_WALLET_SIGNER_KEY",
    env.APPLE_WALLET_SIGNER_KEY,
  );
  const signerKeyPassphrase =
    env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE || undefined;

  // node-forge fails on an encrypted key without a passphrase with a bare
  // "Cannot read properties of undefined (reading 'length')" at signing time.
  if (signerKey.includes("ENCRYPTED") && !signerKeyPassphrase) {
    throw new Error(
      "APPLE_WALLET_SIGNER_KEY is encrypted. Set APPLE_WALLET_SIGNER_KEY_PASSPHRASE, or store an unencrypted key (openssl pkey -in key.pem -out signerKey.pem).",
    );
  }

  try {
    createPrivateKey({ key: signerKey, passphrase: signerKeyPassphrase });
  } catch (error) {
    throw new Error(
      `APPLE_WALLET_SIGNER_KEY is not a valid private key (or the passphrase is wrong): ${String(error)}`,
    );
  }

  return {
    passTypeIdentifier: env.APPLE_WALLET_PASS_TYPE_ID,
    teamIdentifier: env.APPLE_WALLET_TEAM_ID,
    certificates: {
      signerCert: parseCertificate(
        "APPLE_WALLET_SIGNER_CERT",
        env.APPLE_WALLET_SIGNER_CERT,
      ),
      signerKey,
      signerKeyPassphrase,
      wwdr: parseCertificate(
        "APPLE_WALLET_WWDR_CERT",
        env.APPLE_WALLET_WWDR_CERT,
      ),
    },
  };
}

const appleWalletConfig = memoizedWalletConfig(
  "Apple Wallet",
  Object.keys(walletEnvSchema.shape),
  loadWalletConfig,
);

/** Throws when Apple Wallet is missing or misconfigured. */
export const getAppleWalletConfig = appleWalletConfig.get;

/**
 * Environments without certificates (most local setups) hide every Wallet
 * entry point rather than offering a button that can only fail. Unusable
 * values (a raw PEM, a bad passphrase) hide them too, and are logged once.
 */
export const isAppleWalletConfigured = appleWalletConfig.isConfigured;
