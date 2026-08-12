import type { ReactNode } from "react";

/**
 * Three tiers on purpose, and the hierarchy is the point: RSVP is the only
 * filled button in the letter, so the one action with a deadline never
 * competes with anything else.
 *
 *   primary   — filled olive. Reserved for RSVP.
 *   outline   — olive outline.
 *   secondary — muted outline. Optional extras.
 *
 * Separate from components/ui/button.tsx: that one is the compact shadcn
 * control used across the admin surface, while these are the large pill CTAs
 * the letter design calls for.
 */
export type LetterButtonVariant = "primary" | "outline" | "secondary";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 " +
  "font-red-hat text-[15px] font-semibold whitespace-nowrap no-underline " +
  "transition-colors transition-transform duration-200 " +
  "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-olive " +
  "max-sm:w-full motion-reduce:transition-none";

const VARIANTS: Record<LetterButtonVariant, string> = {
  primary:
    "border-transparent bg-olive text-white shadow-cta hover:bg-moss hover:-translate-y-px",
  outline:
    "border-olive bg-transparent text-olive hover:bg-olive hover:text-white hover:-translate-y-px",
  secondary:
    "border-ink/30 bg-transparent text-moss hover:bg-haze hover:-translate-y-px",
};

export function letterButtonClass(
  variant: LetterButtonVariant = "primary",
  extra = "",
) {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

export function LetterButtonLink({
  href,
  variant = "primary",
  children,
  external = false,
}: {
  href: string;
  variant?: LetterButtonVariant;
  children: ReactNode;
  /** External links open in a new tab with the usual rel hardening. */
  external?: boolean;
}) {
  return (
    <a
      href={href}
      className={letterButtonClass(variant)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}
