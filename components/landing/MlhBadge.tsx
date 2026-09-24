import Image from "next/image";

/**
 * MLH trust badge — rests at the top of the hero (absolute, not fixed), a
 * little to the right of the MHacks logo. It scrolls away with the page:
 * once the next sheet slides over the hero, the badge is gone.
 *
 * Horizontal position mirrors SiteHeader's max-w + padding. On mobile the
 * badge sits on the Apply side of the bar; from md up it rests beside the logo.
 */
export function MlhBadge() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-[20] px-4 md:px-8"
    >
      <div className="relative mx-auto max-w-[1440px] px-3 md:px-4">
        <a
          id="mlh-trust-badge"
          href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2026-season&utm_content=black"
          target="_blank"
          rel="noreferrer"
          data-cursor="hover"
          className="pointer-events-auto absolute top-0 block w-[min(100px,max(48px,9vw))] right-[calc(5.5rem+1.25rem)] md:right-auto md:left-[calc(1rem+44px+4rem)]"
        >
          <Image
            src="/logos/mlh-trust-badge-2027-black.svg"
            alt="Major League Hacking 2026 Hackathon Season"
            width={393}
            height={688}
            sizes="100px"
            className="h-auto w-full"
          />
        </a>
      </div>
    </div>
  );
}
