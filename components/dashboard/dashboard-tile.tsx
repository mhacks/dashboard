import Link from "next/link";
import { ArrowUpRightIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One cell of the dashboard grid.
 *
 * Tiles sit on the page's dark photo backdrop, so the surface is `glass-card`
 * (paper-tinted) with moss text inside — the same treatment the decision letter
 * and the apply flow use.
 *
 * Rendered as a link when `href` is set and a plain container otherwise, so a
 * tile whose action is a button (the decision letter opens a modal) still gets
 * identical framing.
 */
export function DashboardTile({
  eyebrow,
  icon: Icon,
  href,
  external,
  className,
  children,
}: {
  eyebrow?: string;
  icon?: LucideIcon;
  href?: string;
  /** Shows the corner arrow. Set for tiles that navigate away. */
  external?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      {(eyebrow || Icon) && (
        <div className="mb-3 flex items-center gap-2">
          {Icon && <Icon className="size-3.5 shrink-0 text-moss/50" />}
          {eyebrow && (
            <span className="font-red-hat text-[11px] font-semibold tracking-[0.14em] text-moss/50 uppercase">
              {eyebrow}
            </span>
          )}
          {external && (
            <ArrowUpRightIcon className="ml-auto size-4 shrink-0 text-moss/35 transition-colors group-hover/tile:text-moss/70" />
          )}
        </div>
      )}
      {children}
    </>
  );

  const classes = cn(
    "glass-card rounded-card group/tile flex flex-col p-5 sm:p-6",
    href &&
      "transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  return <div className={classes}>{body}</div>;
}

/** The tile's headline. Sized down from the page title so tiles stay quiet. */
export function TileTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-red-hat text-[15px] font-semibold text-moss">
      {children}
    </h2>
  );
}

export function TileBody({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-red-hat mt-1.5 text-[13.5px] leading-6 text-moss/60">
      {children}
    </p>
  );
}

/**
 * Status pill. `solid` marks the one state that wants attention — a released
 * decision — so the rest stay visually subordinate to it.
 */
export function TileChip({
  children,
  solid = false,
}: {
  children: React.ReactNode;
  solid?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-red-hat shrink-0 rounded-full px-3 py-1 text-[11px] font-medium tracking-wide uppercase",
        solid
          ? "bg-moss text-white"
          : "bg-moss/10 text-moss/70 ring-1 ring-moss/15",
      )}
    >
      {children}
    </span>
  );
}
