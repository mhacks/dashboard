import type { ReactNode } from "react";

/**
 * A rail: a corner glyph, a label, a hairline that eats the slack, a density
 * ramp, and whatever sits at the far right.
 *
 * Every region on the console opens with one, which is what makes the page
 * read as a stack of panels rather than a stack of cards. Borrowed from the
 * boarding-pass studio's control column, where the same rail introduces every
 * section of the picker.
 */
export type RailCorner = "top" | "mid" | "bottom";

const CORNERS: Record<RailCorner, string> = {
  top: "┌─",
  mid: "├─",
  bottom: "└─",
};

export const RAMP = "░▒▓█";

export function Rail({
  corner = "mid",
  label,
  trailing,
  ramp = true,
}: {
  corner?: RailCorner;
  /** Tracked-out mono label. Omit for a bare rule, as the footer rail does. */
  label?: string;
  /** Anything that closes the rail: a note, a button. */
  trailing?: ReactNode;
  ramp?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className="font-glyph text-xs leading-none text-ui-line-strong select-none"
      >
        {CORNERS[corner]}
      </span>

      {label ? (
        <span className="font-red-hat-mono text-[11px] tracking-[0.18em] whitespace-nowrap text-ui-ink-soft">
          {label}
        </span>
      ) : null}

      <span className="h-0 min-w-2.5 flex-auto self-center border-t border-ui-line" />

      {ramp ? (
        <span
          aria-hidden
          className="overflow-hidden font-glyph text-xs leading-none tracking-[0.04em] whitespace-nowrap text-ui-line-strong select-none max-sm:hidden"
        >
          {RAMP}
        </span>
      ) : null}

      {trailing}
    </div>
  );
}

/** The small mono note that closes a rail, e.g. "Not visible to hackers". */
export function RailNote({ children }: { children: ReactNode }) {
  return (
    <span className="font-red-hat-mono text-[10.5px] tracking-[0.04em] whitespace-nowrap text-ui-ink-soft">
      {children}
    </span>
  );
}
