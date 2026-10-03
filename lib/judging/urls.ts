/**
 * Devpost gallery exports use hackathon submission URLs
 * (`*.devpost.com/submissions/...`). Those 302 to the public project URL
 * hackers paste into the dashboard (`devpost.com/software/...`). The join key
 * is that public URL. A browser user agent is required: the edge rejects a
 * bare client with 403 before the redirect.
 */

export const DEVPOST_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function normalizeDevpostUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./u, "");
  if (host !== "devpost.com" && !host.endsWith(".devpost.com")) return null;
  const path = url.pathname.replace(/\/+$/u, "").toLowerCase() || "/";
  return `https://${host}${path}`;
}

export function isUnresolvedSubmissionUrl(value: string): boolean {
  const normalized = normalizeDevpostUrl(value);
  if (!normalized) return true;
  try {
    return new URL(normalized).pathname.includes("/submissions/");
  } catch {
    return true;
  }
}

async function request(
  fetchImpl: typeof fetch,
  url: string,
  method: "GET" | "HEAD",
): Promise<Response> {
  const response = await fetchImpl(url, {
    method,
    redirect: "manual",
    headers: {
      accept: "text/html",
      "user-agent": DEVPOST_BROWSER_USER_AGENT,
    },
    signal: AbortSignal.timeout(8_000),
  });
  return response;
}

function redirectTarget(response: Response, current: string): string | null {
  if (!REDIRECT_STATUSES.has(response.status)) return null;
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location, current).toString();
}

async function finish(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

export async function resolveDevpostRedirect(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let current = input.trim();
  for (let hop = 0; hop < 5; hop += 1) {
    const head = await request(fetchImpl, current, "HEAD");
    const headNext = redirectTarget(head, current);
    await finish(head);
    if (headNext) {
      current = headNext;
      continue;
    }
    if (head.status === 403 || head.status === 405 || head.status === 501) {
      const get = await request(fetchImpl, current, "GET");
      const getNext = redirectTarget(get, current);
      await finish(get);
      if (getNext) {
        current = getNext;
        continue;
      }
    }
    break;
  }
  return current;
}
