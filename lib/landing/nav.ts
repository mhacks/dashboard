import type { MouseEvent } from "react";

import { asset } from "@/lib/landing/asset";
import { scrollToHash } from "@/lib/landing/scroll";

export interface MarketingNavItem {
  label: string;
  href: string;
  cta?: boolean;
}

export const MARKETING_NAV_ITEMS: MarketingNavItem[] = [
  { label: "About", href: "#about" },
  { label: "Sponsors", href: "#sponsors" },
  { label: "Timeline", href: "#timeline" },
  { label: "Agent", href: "/how-to-mcp" },
  { label: "FAQ", href: "#faq" },
];

export const FOOTER_NAV_ITEMS: MarketingNavItem[] = [
  ...MARKETING_NAV_ITEMS,
  { label: "Contact", href: "mailto:hello@mhacks.org" },
  {
    label: "MLH Policies",
    href: "https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md",
  },
];

/** Strip duplicated fragments (e.g. `#about#about` → `#about`). */
export function normalizeHash(hash: string): string {
  const id = hash.replace(/^#+/, "").split("#")[0];
  return id ? `#${id}` : "";
}

export function isMarketingHome(pathname: string | null): boolean {
  return pathname === "/";
}

/** Hash links as root-absolute paths (e.g. `/#about`). Bare `#about` appends
 *  to the current fragment (`/#sponsors` → `/#sponsors#about`). Off-home
 *  links also need the deploy base path (GitHub Pages). */
export function resolveMarketingHref(href: string, onHome: boolean): string {
  if (href.startsWith("#")) return onHome ? `/${href}` : asset(`/${href}`);
  return href;
}

export function handleMarketingNavClick(
  href: string,
  onHome: boolean,
  e: MouseEvent,
) {
  if (href.startsWith("#") && onHome) {
    e.preventDefault();
    history.replaceState(null, "", href);
    scrollToHash(href);
  }
}
