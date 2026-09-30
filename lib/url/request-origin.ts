import { headers } from "next/headers";

/**
 * Behind the load balancer, a production request can carry the container's
 * internal AWS host, so links and redirects built from it are dead ends.
 */
const PUBLIC_ORIGIN = "https://mhacks.org";

/**
 * The origin for absolute links (emails, passes, redirects): always the public
 * host in production, otherwise the host this request arrived on, so local and
 * preview links point back at themselves.
 */
export async function getRequestOrigin() {
  if (process.env.NODE_ENV === "production") return PUBLIC_ORIGIN;

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
