/**
 * Shared letterhead: green M mark, wordmark, and the decision round.
 *
 * The mark is a plain <img> rather than next/image on purpose — it is a
 * decorative 26px SVG, so there is nothing for the image optimiser to do, and
 * next/image skips SVG optimisation anyway.
 */
export function Letterhead({ roundLabel }: { roundLabel: string }) {
  return (
    <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-ink/15 bg-haze px-[22px] py-[18px] sm:px-[34px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decision/mhacks-m.svg"
        alt=""
        width={26}
        height={26}
        className="block size-[26px] object-contain"
      />
      <p className="font-red-hat text-[17px] font-bold tracking-[0.12em] text-olive uppercase">
        MHacks 2026
      </p>
      <span aria-hidden className="font-red-hat text-[13px] text-ink/30">
        ·
      </span>
      <p className="font-red-hat text-[11px] font-semibold tracking-[0.24em] text-ink/55 uppercase">
        {roundLabel}
      </p>
    </header>
  );
}
