/**
 * The key two Devpost links are matched on: host without `www.` and path
 * without a trailing slash, lowercased, ignoring the scheme and query.
 *
 * Mirrors `normalize_url` in MDredd's app/project.py, so a link a team saved
 * here and the `Project Url` MDredd resolved compare the same on both sides.
 */
export function normalizeDevpostUrl(url: string): string {
  const value = url.trim().toLowerCase();
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");
    return `${host}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return value;
  }
}
