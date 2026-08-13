/**
 * Prefixes a public-asset path with the deploy base path (e.g. GitHub Pages
 * serves the site under /mhacks-2026-site). Next's basePath only rewrites
 * routes and optimized images, not raw <img>/CSS URLs, so every reference to
 * a file in /public should go through this helper.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
