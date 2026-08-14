import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Rail } from "./rail";

function ConsoleFieldPhoto() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[#8f8f8a]"
    >
      <Image
        src="/decision/bg-console.jpg"
        alt=""
        fill
        sizes="100vw"
        priority
        className="object-cover object-center"
      />
    </div>
  );
}

/**
 * The console shell: a screened photograph edge to edge, and a sheet of paper
 * standing on it.
 *
 * The sheet is trimmed well short of the window so the garden shows down both
 * edges — the boarding-pass studio's own arrangement, where the pass never
 * bleeds to the frame. Everything inside keeps its distance from that trim, so
 * no panel looks tipped off the paper.
 *
 * `centred` is for the rejection, the one screen short enough to sit in the
 * middle of the window and the one that should: a short letter pinned to the
 * top of a tall photograph reads as an offcut.
 */
export function ConsoleShell({
  children,
  width = "wide",
  centred = false,
  field = true,
}: {
  children: ReactNode;
  width?: "wide" | "letter";
  centred?: boolean;
  /**
   * Whether the shell paints its own garden. Off for the decision letters,
   * which sit on <DecisionBackdrop> instead — their photograph is chosen by
   * the decision.
   */
  field?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col px-2.5 pt-3 pb-4 sm:px-6.5 sm:pt-9 sm:pb-11",
        centred && "justify-center",
      )}
    >
      {field ? <ConsoleFieldPhoto /> : null}
      <div
        className={cn(
          "console-sheet relative z-10 mx-auto w-full border border-ui-line-strong shadow-[0_2px_30px_rgba(23,23,26,0.22)]",
          width === "letter" ? "max-w-[680px]" : "max-w-[1064px]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** The dashboard's own padding. A letter sets its own, section by section. */
export function ConsolePage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[26px] px-4 pt-6.5 pb-7.5 sm:gap-[34px] sm:px-[46px] sm:pt-[42px] sm:pb-12">
      {children}
    </div>
  );
}

/**
 * The masthead. The title carries the console prompt and a blinking block
 * cursor — the one piece of ambient motion on the page, and the thing that
 * says this surface is a terminal rather than a document.
 *
 * `trailing` closes the rail. In the prototype this was a hardcoded sign-out
 * href; here it takes a node so the real sign-out (a server action, not a
 * link) can sit there without this component knowing about auth.
 */
export function Masthead({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4.5">
      <Rail corner="top" label="MHACKS 2026" trailing={trailing} />

      <h1 className="font-red-hat-mono text-[23px] leading-tight font-bold tracking-[-0.01em] text-balance text-ui-ink sm:text-[28px]">
        <span aria-hidden className="font-glyph select-none">
          &gt;
        </span>{" "}
        {title}{" "}
        <span
          aria-hidden
          className="console-cursor inline-block font-glyph select-none"
        >
          ▌
        </span>
      </h1>
    </header>
  );
}

/**
 * The rule that closes the sheet.
 *
 * The prototype carried its own footer nav here. The real site's compact
 * <Footer> already renders below the sheet with the same links, so this is
 * just the terminator — duplicating the nav inside the paper would say the
 * page ends twice.
 */
export function ConsoleFooterRule() {
  return <Rail corner="bottom" />;
}
