import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Three tiers, and the hierarchy is the point: the primary is the only filled
 * button on a screen, so the one action with a deadline never competes with
 * the optional ones.
 *
 *   primary   — filled ink, prefixed with the console prompt. Reserved for the
 *               action the screen exists for: RSVP, continue, see decision.
 *   outline   — hairline border. Important, but not the deadline.
 *   secondary — filled with the selected-chip wash. Optional extras.
 */
export type ButtonVariant = "primary" | "outline" | "secondary";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[2px] border px-5 py-3.5 " +
  "font-red-hat-mono text-[13px] tracking-[0.02em] whitespace-nowrap no-underline " +
  "transition-[transform,background-color,color,opacity] duration-200 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink " +
  "max-sm:w-full motion-reduce:transition-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-ui-ink bg-ui-ink text-ui-surface hover:-translate-y-px hover:opacity-90",
  outline:
    "border-ui-line-strong bg-transparent text-ui-ink hover:-translate-y-px hover:bg-ui-selected",
  secondary:
    "border-ui-line-strong bg-ui-selected text-ui-ink hover:-translate-y-px hover:bg-ui-well",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

/** The `>` that marks a primary action as the screen's prompt. */
export function Caret() {
  return (
    <span aria-hidden className="font-glyph select-none">
      &gt;
    </span>
  );
}

/**
 * `external` defaults to true — it was written for a page of outbound links.
 * Every in-app destination must pass `external={false}`, which also routes it
 * through next/link so the navigation is client-side.
 */
export function ButtonLink({
  href,
  variant = "primary",
  children,
  external = true,
}: {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
  external?: boolean;
}) {
  const content = (
    <>
      {variant === "primary" ? <Caret /> : null}
      {children}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass(variant)}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={buttonClass(variant)}>
      {content}
    </Link>
  );
}
