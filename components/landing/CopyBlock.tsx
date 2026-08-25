"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Copy-to-clipboard chip + command block, shared by the How to MCP page and
 * the home Agent section. `emphasized` inverts the block into the brand
 * moss fill for the one command that matters most (the server URL).
 */
export function CopyChip({
  text,
  label = "copy",
  emphasized = false,
}: {
  text: string;
  label?: string;
  emphasized?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      data-cursor="hover"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => setCopied(true))
      }
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      className={cn(
        "shrink-0 rounded-pill border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-700",
        copied
          ? emphasized
            ? "border-cream bg-cream text-moss-700"
            : "border-moss-700 bg-moss-700 text-cream"
          : emphasized
            ? "border-cream/50 text-cream hover:border-cream"
            : "border-[rgba(29,36,18,0.25)] text-moss-700/80 hover:border-moss-700",
      )}
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}

export function CommandBlock({
  children,
  emphasized = false,
}: {
  children: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3",
        emphasized
          ? "border-moss-700 bg-moss-700 py-3.5 shadow-[0_12px_32px_-12px_rgba(58,74,38,0.55)]"
          : "border-[rgba(29,36,18,0.2)] bg-cream",
      )}
    >
      <code
        className={cn(
          "min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[13px] leading-relaxed sm:text-[14px]",
          emphasized ? "text-cream" : "text-moss-700",
        )}
      >
        {children}
      </code>
      <CopyChip text={children} emphasized={emphasized} />
    </div>
  );
}
