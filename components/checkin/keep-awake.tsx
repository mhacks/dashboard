"use client";

import { useEffect } from "react";

/**
 * Holds a screen wake lock for as long as it is mounted, so a hacker standing
 * in the check-in line doesn't watch their code dim out before they reach the
 * front.
 *
 * There is no web API to raise brightness — this is the closest thing there is,
 * and it is best-effort: unsupported on iOS before 16.4, and the request
 * rejects outright if the page isn't visible. Renders nothing either way.
 */
export function KeepAwake() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Denied, or the page lost visibility mid-request. Nothing to do —
        // the screen simply dims on its usual timer.
      }
    };

    // The lock is released automatically whenever the page is hidden, so
    // coming back to the tab has to ask for it again.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  return null;
}
