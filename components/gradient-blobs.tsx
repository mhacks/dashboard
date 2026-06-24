// Each blob is a circle whose center sits on the screen edge, so only the
// inner half is visible — a half-circle wrapping around the flowers, which are
// also vertically centered (top: 50%) on each side.
// Full circle diameter (half of it shows). It scales with the viewport
// (proportional to the flowers) but never shrinks below MIN_DIAM, so it always
// stays large enough to surround the flowers. Below md (768px) the blobs are
// removed entirely via `hidden md:block`, so they disappear with the flowers
// instead of continuing to shrink past them.
const FLOWER_VW = 50; // proportional to the flowers (~3.2x their 30vw)
const MIN_DIAM = 100; // px — floor that still surrounds the flowers at md
const MAX_DIAM = 900; // px — cap on large screens
const DIAM = `clamp(${MIN_DIAM}px, ${FLOWER_VW}vw, ${MAX_DIAM}px)`;
const HALF_OFFSET = `calc(${DIAM} / -2)`; // pulls the circle center onto the edge
const PINK = "rgba(255,170,216,0.9)"; // stronger pink
const BLUE = "rgba(190,220,255,0.9)"; // stronger blue
const CORE = "60%"; // color stays solid out to here
const EDGE = "76%"; // gone by here — the CORE→EDGE band is the visible perimeter
const SOFTEN = 8; // px blur; small so the rim stays defined

export default function GradientBlobs() {
  return (
    <>
      {/* Pink half-circle — left side, centered on the flowers */}
      <div
        className="pointer-events-none absolute hidden md:block"
        aria-hidden
        style={{
          width: DIAM,
          height: DIAM,
          background: `radial-gradient(circle, ${PINK} 0%, ${PINK} ${CORE}, rgba(255,170,216,0) ${EDGE})`,
          filter: `blur(${SOFTEN}px)`,
          left: HALF_OFFSET,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
      {/* Blue half-circle — right side, centered on the flowers */}
      <div
        className="pointer-events-none absolute hidden md:block"
        aria-hidden
        style={{
          width: DIAM,
          height: DIAM,
          background: `radial-gradient(circle, ${BLUE} 0%, ${BLUE} ${CORE}, rgba(190,220,255,0) ${EDGE})`,
          filter: `blur(${SOFTEN}px)`,
          right: HALF_OFFSET,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    </>
  );
}
