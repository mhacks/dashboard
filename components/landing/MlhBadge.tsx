import { asset } from "@/lib/landing/asset";

/**
 * MLH trust badge — rests at the top of the hero (absolute, not fixed), a
 * little to the right of the MHacks logo. It scrolls away with the page:
 * once the next sheet slides over the hero, the badge is gone.
 */
export function MlhBadge() {
  return (
    <a
      id="mlh-trust-badge"
      href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2026-season&utm_content=black"
      target="_blank"
      rel="noreferrer"
      data-cursor="hover"
      className="absolute top-0 z-[20] block w-[9%] min-w-[48px] max-w-[100px] right-[124px] md:left-[calc(clamp(110px,9vw,140px)+50px)] md:right-auto"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset("/logos/mlh-trust-badge-2027-black.svg")}
        alt="Major League Hacking 2026 Hackathon Season"
        className="w-full"
      />
    </a>
  );
}
