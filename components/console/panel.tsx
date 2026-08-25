import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { RAMP } from "./rail";

/**
 * A console panel: a bordered region with a header bar carved into the top.
 *
 * The bar carries the panel's eyebrow on the left and, optionally, its status
 * on the right — "In review", "Decision ready", "Going". That is the whole
 * status treatment on this design: no pills, no colour. Where the applicant
 * stands is stated in words, in the same tracked-out mono as everything else.
 */
export function Panel({
  eyebrow,
  status,
  children,
  className,
}: {
  eyebrow: string;
  status?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-ui-line bg-ui-paper", className)}>
      <PanelBar eyebrow={eyebrow} status={status} />
      <div className="flex flex-col gap-[18px] px-4 pt-5 pb-[18px] sm:px-6 sm:pt-[26px] sm:pb-6">
        {children}
      </div>
    </section>
  );
}

export function PanelBar({
  eyebrow,
  status,
}: {
  eyebrow: string;
  status?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-ui-line bg-ui-well px-2.5 py-1.5">
      <span className="font-red-hat-mono text-[11px] tracking-[0.18em] whitespace-nowrap text-ui-ink-soft">
        {eyebrow}
      </span>
      <span className="h-0 min-w-2.5 flex-auto self-center border-t border-ui-line" />
      {status ? (
        <span className="font-red-hat-mono text-[10.5px] tracking-[0.04em] whitespace-nowrap text-ui-ink-soft">
          {status}
        </span>
      ) : (
        <span
          aria-hidden
          className="overflow-hidden font-glyph text-xs leading-none tracking-[0.04em] whitespace-nowrap text-ui-line-strong select-none max-sm:hidden"
        >
          {RAMP}
        </span>
      )}
    </div>
  );
}

export function PanelHeading({
  children,
  lede,
}: {
  children: ReactNode;
  lede?: ReactNode;
}) {
  return (
    <div>
      <h2 className="font-red-hat-mono text-lg leading-tight font-bold tracking-[-0.01em] text-balance text-ui-ink sm:text-[21px]">
        {children}
      </h2>
      {lede ? (
        <p className="mt-2.5 max-w-[62ch] text-sm leading-[1.55] text-ui-ink-soft">
          {lede}
        </p>
      ) : null}
    </div>
  );
}
