import type { ReactNode } from "react";
import Link from "next/link";

import { PanelBar } from "./panel";

const CARD_CLASS =
  "group flex flex-col border border-ui-line bg-ui-paper text-ui-ink no-underline transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-ui-line-strong hover:bg-ui-selected focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/**
 * A card in a grid of onward links — organizer tools, or the things an
 * accepted hacker can go and do next.
 *
 * The whole card is the link, and it says so on hover by taking the same wash
 * a selected chip takes in the studio's pickers. The ↗ in the bar is the only
 * ornament, and it is doing a job: it marks the card as leaving this page.
 */
export function ToolCard({
  eyebrow,
  name,
  description,
  href,
  /** Off for in-app destinations, so they navigate in place through next/link. */
  external = false,
}: {
  eyebrow: string;
  name: string;
  description: string;
  href: string;
  external?: boolean;
}) {
  const body = (
    <>
      <PanelBar eyebrow={eyebrow} status="↗" />

      <div className="flex flex-col gap-1.5 px-3 pt-3.5 pb-[15px]">
        <span className="font-red-hat-mono text-[15px] font-medium tracking-[-0.005em]">
          {name}
        </span>
        <p className="text-[13px] leading-normal text-ui-ink-soft">
          {description}
        </p>
      </div>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={CARD_CLASS}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={href} className={CARD_CLASS}>
      {body}
    </Link>
  );
}

export function ToolGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(232px,1fr))] gap-2.5">
      {children}
    </div>
  );
}
