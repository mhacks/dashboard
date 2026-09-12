import type { EmailThemeTokens } from "@/lib/email/types";
import type { DirectSendStatus, TestSendProof } from "./campaign-types";

const themeStorageKey = "mhacks-email-active-theme";
const themeStorageVersionKey = "mhacks-email-active-theme-version";
const currentThemeStorageVersion = "m26-single-font-config";
const activeSendStatusStorageKey = "mhacks-email-active-send-status";
const activeSendRecipientsStorageKey = "mhacks-email-active-send-recipients";
const activeTestProofStorageKey = "mhacks-email-active-test-proof";

export function loadStoredTheme() {
  if (!canUseLocalStorage()) {
    return null;
  }

  if (
    window.localStorage.getItem(themeStorageVersionKey) !==
    currentThemeStorageVersion
  ) {
    window.localStorage.removeItem(themeStorageKey);
    return null;
  }

  return readStorage<EmailThemeTokens | null>(themeStorageKey, null);
}

export function storeTheme(theme: EmailThemeTokens) {
  writeStorage(themeStorageVersionKey, currentThemeStorageVersion);
  writeJsonStorage(themeStorageKey, theme);
}

export function loadStoredSendStatus() {
  const stored = readStorage<
    (DirectSendStatus & { staleBatchCursor?: number }) | null
  >(activeSendStatusStorageKey, null);

  return stored
    ? {
        ...stored,
        interrupted:
          stored.interrupted ?? stored.staleBatchCursor !== undefined,
        leaseActive: stored.leaseActive ?? false,
        leaseExpiresAt: stored.leaseExpiresAt ?? null,
        unverifiedRecipients: stored.unverifiedRecipients ?? [],
      }
    : null;
}

export function storeSendStatus(status: DirectSendStatus) {
  writeJsonStorage(activeSendStatusStorageKey, status);
}

export function removeStoredSendStatus() {
  removeStorage(activeSendStatusStorageKey);
}

export function loadStoredSendRecipients() {
  if (!canUseLocalStorage()) {
    return "";
  }

  return window.localStorage.getItem(activeSendRecipientsStorageKey) ?? "";
}

export function storeSendRecipients(recipients: string) {
  writeStorage(activeSendRecipientsStorageKey, recipients);
}

export function removeStoredSendRecipients() {
  removeStorage(activeSendRecipientsStorageKey);
}

export function loadStoredTestSendProof() {
  return readStorage<TestSendProof | null>(activeTestProofStorageKey, null);
}

export function storeTestSendProof(proof: TestSendProof) {
  writeJsonStorage(activeTestProofStorageKey, proof);
}

export function removeStoredTestSendProof() {
  removeStorage(activeTestProofStorageKey);
}

export function readStorage<T>(key: string, fallback: T): T {
  if (!canUseLocalStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key: string, value: unknown) {
  writeStorage(key, JSON.stringify(value));
}

export function writeStorage(key: string, value: string) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(key, value);
}

export function removeStorage(key: string) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
}

export function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
