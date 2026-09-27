import "server-only";

/**
 * Env vars are fixed for the process, so a Wallet platform's config is loaded
 * once and the result — or the error — is cached.
 *
 * `isConfigured` hides that platform's entry points when loading fails. It
 * stays quiet when none of `envKeys` are set, the expected local setup, and
 * logs once when any are: a present-but-unusable value (a raw PEM, a bad
 * passphrase, a malformed issuer ID) is a misconfiguration someone should see.
 */
export function memoizedWalletConfig<T>(
  label: string,
  envKeys: readonly string[],
  load: () => T,
) {
  let cached: T | null = null;
  let cachedError: Error | null = null;

  function get(): T {
    if (cached) return cached;
    if (cachedError) throw cachedError;

    try {
      cached = load();
      return cached;
    } catch (error) {
      cachedError = error instanceof Error ? error : new Error(String(error));
      throw cachedError;
    }
  }

  function isConfigured() {
    if (cached) return true;
    if (cachedError) return false;

    try {
      get();
      return true;
    } catch (error) {
      if (envKeys.some((key) => process.env[key])) {
        console.error(`[wallet] ${label} disabled:`, error);
      }
      return false;
    }
  }

  return { get, isConfigured };
}
