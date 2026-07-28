"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  handleMarketingNavClick,
  isMarketingHome,
  MARKETING_NAV_ITEMS,
  resolveMarketingHref,
  type MarketingNavItem,
} from "@/lib/landing/nav";
import { cn } from "@/lib/utils";

interface Props {
  items?: MarketingNavItem[];
  className?: string;
  variant?: "light" | "dark";
  /** Inline overrides (e.g. adaptive nav tone); wins over variant styling. */
  style?: React.CSSProperties;
}

export function PillNav({
  items = MARKETING_NAV_ITEMS,
  className,
  variant = "light",
  style,
}: Props) {
  const onHome = isMarketingHome(usePathname());
  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 }}
      aria-label="Primary"
      className={cn(
        "inline-flex items-center gap-0 rounded-pill border pl-1.5 pr-1.5 py-1 backdrop-blur-xl",
        variant === "light"
          ? "border-white/45 bg-[rgba(245,241,222,0.55)] shadow-e-glass text-ink"
          : "border-white/10 bg-black/25 text-cream",
        className,
      )}
      style={{
        boxShadow:
          variant === "light"
            ? "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 30px rgba(29,36,18,0.18)"
            : undefined,
        ...style,
      }}
    >
      {items.map((it) => (
        <Link
          key={it.href}
          href={resolveMarketingHref(it.href, onHome)}
          data-cursor="hover"
          onClick={(e) => handleMarketingNavClick(it.href, onHome, e)}
          className={cn(
            "font-display px-4 py-1.5 text-[15px] font-medium leading-none rounded-pill transition-all duration-300",
            it.cta
              ? variant === "light"
                ? "bg-moss-800 text-cream shadow-e-2 hover:bg-moss-900"
                : "bg-cream text-moss-900 hover:bg-white"
              : variant === "light"
                ? "hover:bg-moss-700/10 hover:text-moss-800"
                : "hover:bg-cream/15",
          )}
        >
          {it.label}
        </Link>
      ))}
    </motion.nav>
  );
}
