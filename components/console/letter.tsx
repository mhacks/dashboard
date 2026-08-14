import Image from "next/image";
import type { ReactNode } from "react";

/**
 * The pieces a decision letter is built from.
 *
 * A letter is read rather than scanned, so it drops the dashboard's panels for
 * a single column of banded sections — but it is printed on the same stock,
 * with the same rails and the same mono. Opening a decision should not feel
 * like leaving the product.
 *
 * Moss and olive survive the restyle and are the only colour on either screen.
 * They carry the headings of the acceptance, which is the one place on the
 * whole journey where colour is the message.
 */
export function LetterSection({
  children,
  tone = "paper",
}: {
  children: ReactNode;
  /** Sections alternate so the letter reads as bands rather than one slab. */
  tone?: "paper" | "well";
}) {
  return (
    <section
      className={`border-b border-ui-line px-[22px] py-6 last:border-b-0 sm:px-[34px] sm:py-[30px] ${
        tone === "well" ? "bg-ui-well" : "bg-ui-paper"
      }`}
    >
      {children}
    </section>
  );
}

export function LetterKicker({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 block font-red-hat-mono text-[10.5px] font-bold tracking-[0.24em] uppercase text-olive">
      {children}
    </span>
  );
}

export function LetterTitle({
  children,
  /** The rejection's headline is quieter: smaller, lighter, in ink not moss. */
  quiet = false,
}: {
  children: ReactNode;
  quiet?: boolean;
}) {
  return (
    <h1
      className={
        quiet
          ? "mb-3.5 font-red-hat-mono text-[21px] leading-[1.14] font-medium tracking-[-0.01em] text-balance text-ui-ink sm:text-2xl"
          : "mb-3.5 font-red-hat-mono text-[24px] leading-[1.14] font-bold tracking-[-0.02em] text-balance text-moss sm:text-[30px]"
      }
    >
      {children}
    </h1>
  );
}

export function LetterHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2.5 font-red-hat-mono text-[19px] leading-tight font-bold tracking-[-0.01em] text-moss">
      {children}
    </h2>
  );
}

export function LetterBody({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3.5 max-w-[62ch] text-[15px] leading-[1.66] text-ui-ink last:mb-0">
      {children}
    </p>
  );
}

/** Takes its text from lib/decisions.ts rather than hardcoding the year. */
export function Signoff({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5.5 font-red-hat-mono text-sm font-bold text-moss">
      {children}
    </p>
  );
}

/**
 * A section that shows the thing it is describing.
 *
 * The image sits in its own fixed column so the paragraph beside it keeps a
 * readable measure; below 640px the two stack and the image goes full width.
 */
export function Showcase({
  children,
  image,
  width,
  height,
  caption,
  /** A die-cut sticker has its own edge — a frame would draw a box around it. */
  cutout = false,
}: {
  children: ReactNode;
  image: string;
  width: number;
  height: number;
  caption: string;
  cutout?: boolean;
}) {
  return (
    <div className="grid items-start gap-6 grid-cols-[minmax(0,1fr)_240px] max-[640px]:grid-cols-[minmax(0,1fr)]">
      <div>{children}</div>

      <figure className="m-0">
        <Image
          src={image}
          alt=""
          width={width}
          height={height}
          sizes="240px"
          className={`block h-auto w-full ${cutout ? "py-1" : "border border-ui-line-strong"}`}
        />
        <figcaption className="mt-[7px] block font-red-hat-mono text-[10px] tracking-[0.14em] uppercase text-ui-ink-soft">
          {caption}
        </figcaption>
      </figure>
    </div>
  );
}
