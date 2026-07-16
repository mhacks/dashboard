import posthog from "posthog-js";
import type { CaptureResult } from "posthog-js";

function isAdminPath(value: unknown) {
  if (typeof value !== "string") return false;

  try {
    return new URL(value, window.location.origin).pathname.startsWith("/admin");
  } catch {
    return value.startsWith("/admin");
  }
}

function shouldDropAdminEvent(event: CaptureResult | null) {
  if (typeof window !== "undefined" && isAdminPath(window.location.pathname)) {
    return true;
  }

  const properties = event?.properties;
  return (
    isAdminPath(properties?.$current_url) || isAdminPath(properties?.$pathname)
  );
}

if (process.env.NODE_ENV !== "development") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    before_send: (event) => (shouldDropAdminEvent(event) ? null : event),
  });
}
