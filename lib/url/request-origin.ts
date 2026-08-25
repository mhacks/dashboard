import { headers } from "next/headers";

export async function getRequestOrigin() {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    headerList.get("host");

  if (!host) {
    throw new Error("Unable to determine request origin.");
  }

  const forwardedProto = headerList
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const protocol =
    forwardedProto ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}
