import Image from "next/image";

const BACKDROPS = {
  accepted: "/decision/bg-accepted.jpg",
  rejected: "/decision/bg-rejected.png",
} as const;

/**
 * The photograph behind a decision letter.
 *
 * One layer, not two: the scrim that used to sit over this is gone. The
 * console sheet separates itself from the photograph with a hairline and a
 * drop shadow, and the wash only muddied the picture.
 */
export function DecisionBackdrop({
  outcome,
}: {
  outcome: keyof typeof BACKDROPS;
}) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-moss">
      <Image
        src={BACKDROPS[outcome]}
        alt=""
        fill
        sizes="100vw"
        priority
        className="object-cover object-center"
      />
    </div>
  );
}
