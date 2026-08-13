import type { ReactNode } from "react";
import type { BouquetId } from "@/lib/pass/types";

/*
  The bouquet sticker that goes in the slot on the pass.

  Three built in here, plus "upload your own" — which is the hand-off to the
  bouquet mini-game: a hacker builds a bouquet there, downloads it as a PNG, and
  drops that PNG into the slot as their own mark on the pass.
*/

/** The bouquet mini-game. Fill this in and the fine print becomes a real link. */
export const BOUQUET_GAME_URL = "";

export const BOUQUET_FINE_PRINT_PREFIX =
  "Create and add your own unique bouquet with ";
export const BOUQUET_FINE_PRINT_LINK = "unique bouquet";

export type BouquetDef = {
  id: BouquetId;
  label: string;
  art: ReactNode;
};

/*
  Drawn on a 64-unit square so the slot can scale them freely. Line art in
  currentColor, which the slot sets to the pass's ink — they read as printed on
  the stock rather than pasted onto it.
*/
function Art({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** A five-petal bloom on a stem. */
function bloom(cx: number, cy: number, r: number, petal: number) {
  return (
    <>
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx={cx}
          cy={cy - r}
          rx={petal}
          ry={r * 0.86}
          transform={`rotate(${deg} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.3} />
    </>
  );
}

export const BOUQUETS: BouquetDef[] = [
  {
    id: "posy",
    label: "Posy",
    art: (
      <Art>
        <path d="M32 56V34" />
        <path d="M32 44C24 44 19 39 18 32C26 32 31 37 32 44Z" />
        <path d="M32 40C40 40 45 35 46 28C38 28 33 33 32 40Z" />
        {bloom(32, 24, 7, 3.2)}
        <path d="M25 56H39" />
      </Art>
    ),
  },
  {
    id: "sprigs",
    label: "Sprigs",
    art: (
      <Art>
        <path d="M22 56C22 44 20 32 15 22" />
        <path d="M32 56C32 42 32 28 32 16" />
        <path d="M42 56C42 44 44 32 49 22" />
        {[
          [15, 22],
          [32, 16],
          [49, 22],
        ].map(([x, y]) => (
          <circle key={`${x}`} cx={x} cy={y} r="4" />
        ))}
        <path d="M24 42C20 42 17 39 16 35C20 35 23 38 24 42Z" />
        <path d="M40 46C44 46 47 43 48 39C44 39 41 42 40 46Z" />
        <path d="M32 38C28 38 25 35 24 31C28 31 31 34 32 38Z" />
        <path d="M20 56H44" />
      </Art>
    ),
  },
  {
    id: "wreath",
    label: "Wreath",
    art: (
      <Art>
        <circle cx="32" cy="32" r="19" strokeDasharray="3 4" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 32 32)`}>
            <ellipse cx="32" cy="13" rx="3.4" ry="6" />
          </g>
        ))}
        {bloom(32, 32, 6, 2.8)}
      </Art>
    ),
  },
];

// Re-exported from its own module so the server-side prefill can read it
// without importing this one, which is all inline SVG.
export { DEFAULT_BOUQUET } from "@/lib/pass/limits";

export function bouquetDef(id: BouquetId): BouquetDef | null {
  return BOUQUETS.find((b) => b.id === id) ?? null;
}
