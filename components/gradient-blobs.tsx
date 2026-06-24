// Each blob is a circle whose center sits on the screen edge, so only the
// inner half is visible — a half-circle wrapping around the flowers, which are
// also vertically centered (top: 50%) on each side.
const DIAM = 900; // px — full circle diameter (half of it shows)
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
        className="pointer-events-none absolute"
        aria-hidden
        style={{
          width: DIAM,
          height: DIAM,
          background: `radial-gradient(circle, ${PINK} 0%, ${PINK} ${CORE}, rgba(255,170,216,0) ${EDGE})`,
          filter: `blur(${SOFTEN}px)`,
          left: -DIAM / 2,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
      {/* Blue half-circle — right side, centered on the flowers */}
      <div
        className="pointer-events-none absolute"
        aria-hidden
        style={{
          width: DIAM,
          height: DIAM,
          background: `radial-gradient(circle, ${BLUE} 0%, ${BLUE} ${CORE}, rgba(190,220,255,0) ${EDGE})`,
          filter: `blur(${SOFTEN}px)`,
          right: -DIAM / 2,
          top: "50%",
          transform: "translateY(-50%)",
        }}
      />
    </>
  );
}
