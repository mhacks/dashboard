import type { FontId } from "@/lib/pass/types";

export type FontDef = {
  id: FontId;
  /** Chip label — set in its own typeface, so the chip previews itself. */
  label: string;
  stack: string;
  /** Weight for the PASSENGER name. Normalizes apparent weight across faces. */
  nameWeight: number;
  /** Multiplier on the PASSENGER name size. Normalizes apparent size. */
  nameScale: number;
  /** Tracking for the PASSENGER name, in em. */
  nameTracking: number;
  /** Weight for the FROM/TO codes. */
  codeWeight: number;
};

/*
  Three faces, each doing a different job.

  Red Hat Display is the MHacks site's own display face and leads as the default,
  so an untouched pass still reads as native to the site. Instrument Serif is the
  site's editorial accent. Space Grotesk is the odd one out — not a site face,
  but a technical wide-aperture grotesque that suits the blueprint direction and
  is the only option here that doesn't read as a near-neighbour of Red Hat.

  Red Hat Mono is not an option: it stays as --mh-ui-mono for every field label
  on the ticket, which is what makes the pass read as printed rather than typeset.

  Every stack is a CSS variable, never a literal family name. next/font
  generates hashed families ('__Space_Grotesk_a1b2c3'), so "'Space Grotesk'"
  matches nothing and would fall silently through to system-ui — the pass
  would still render, just in the wrong face, which is the kind of bug you
  only notice in the exported PNG.
*/
export const FONTS: FontDef[] = [
  {
    id: "display",
    label: "Red Hat Display",
    stack: "var(--font-red-hat-display), system-ui, sans-serif",
    nameWeight: 700,
    nameScale: 1,
    nameTracking: -0.02,
    codeWeight: 700,
  },
  {
    id: "serif",
    label: "Instrument Serif",
    stack: "var(--font-instrument-serif), serif",
    nameWeight: 400,
    nameScale: 1.14,
    nameTracking: -0.01,
    codeWeight: 400,
  },
  {
    id: "grotesk",
    label: "Space Grotesk",
    stack: "var(--font-space-grotesk), system-ui, sans-serif",
    nameWeight: 700,
    nameScale: 0.98,
    nameTracking: -0.03,
    codeWeight: 700,
  },
];

export const DEFAULT_FONT: FontId = "display";

export function fontDef(id: FontId): FontDef {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}
