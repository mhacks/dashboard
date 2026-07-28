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

export function isMarketingHome(pathname: string | null): boolean {
  return pathname === "/";
}

/** Hash links on subpages must include the deploy base path (GitHub Pages). */
export function resolveMarketingHref(href: string, onHome: boolean): string {
  if (href.startsWith("#") && !onHome) return asset(`/${href}`);
  return href;
}

export function handleMarketingNavClick(
  href: string,
  onHome: boolean,
  e: MouseEvent,
) {
  if (href.startsWith("#") && onHome) {
    e.preventDefault();
    scrollToHash(href);
  }
}
