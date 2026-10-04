"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Reloads the page's data once `ms` have passed, e.g. when a lockout ends. */
export function RefreshAfter({ ms }: { ms: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setTimeout(() => router.refresh(), ms + 1_000);
    return () => window.clearTimeout(id);
  }, [ms, router]);
  return null;
}
