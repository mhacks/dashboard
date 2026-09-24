/*
  Boarding-pass geometry.

  The whole silhouette — rounded corners plus the two semicircular notches at
  the perforation — is one `clip-path: path()`. Deliberately not a mask with
  composited radial gradients and deliberately not `clip-path: url(#id)`:

  - Overlapping background-colored circles would show up as opaque blobs once
    the PNG is exported over transparency.
  - `url(#id)` references a node outside the exported subtree, which does not
    survive html-to-image's clone-into-foreignObject step.

  An inline path() carries no external reference and serializes as a plain
  computed style string, so it survives export intact.
*/

export const TICKET_W = 900;
export const TICKET_H = 340;

/**
 * The portrait pass — the same ticket turned on its end, long side vertical.
 * Not a rotation of the landscape one: the fields are re-laid out upright, and
 * the tear-off runs across the bottom instead of down the right.
 *
 * Deliberately not the landscape ratio flipped. A true 340×900 flip is far
 * taller than any real ticket and left the fields marooned in white space;
 * these proportions are closer to a printed stub, and because the frame scales
 * the pass to fit, a shorter pass is also a *wider* one on screen.
 */
export const TICKET_P_W = 360;
export const TICKET_P_H = 620;

/** Corner radius. */
export const CORNER_R = 16;

/** Radius of the notch bitten out of the edges at the perforation. */
export const NOTCH_R = 13;

/** Stub is the last ~28% of the long side; the main body is the rest. */
export const STUB_RATIO = 0.28;

/** x of the landscape perforation, and of both its notch centers. */
export const PERF_X = Math.round(TICKET_W * (1 - STUB_RATIO)); // 648

/** y of the portrait perforation, and of both its notch centers. */
export const PERF_Y = Math.round(TICKET_P_H * (1 - STUB_RATIO)); // 446

/**
 * Builds the ticket outline, clockwise from just after the top-left corner.
 *
 * Arc flags, for the next person reading this: SVG y points down, so an arc
 * that dips *into* the ticket sweeps toward decreasing angle — sweep-flag 0 for
 * the two notches. The four corners bulge outward and sweep-flag 1.
 */
export function ticketClipPath(
  w = TICKET_W,
  h = TICKET_H,
  corner = CORNER_R,
  notch = NOTCH_R,
  perfX = PERF_X,
): string {
  return [
    `M ${corner} 0`,
    // top edge, left of the notch
    `L ${perfX - notch} 0`,
    // top notch — dips down into the ticket
    `A ${notch} ${notch} 0 0 0 ${perfX + notch} 0`,
    // top edge, right of the notch
    `L ${w - corner} 0`,
    `A ${corner} ${corner} 0 0 1 ${w} ${corner}`,
    // right edge
    `L ${w} ${h - corner}`,
    `A ${corner} ${corner} 0 0 1 ${w - corner} ${h}`,
    // bottom edge, right of the notch
    `L ${perfX + notch} ${h}`,
    // bottom notch — rises up into the ticket
    `A ${notch} ${notch} 0 0 0 ${perfX - notch} ${h}`,
    // bottom edge, left of the notch
    `L ${corner} ${h}`,
    `A ${corner} ${corner} 0 0 1 0 ${h - corner}`,
    // left edge
    `L 0 ${corner}`,
    `A ${corner} ${corner} 0 0 1 ${corner} 0`,
    "Z",
  ].join(" ");
}

/**
 * The portrait outline: same grammar turned 90°, so the notches bite into the
 * left and right edges at a horizontal perforation. Corner arcs still sweep 1;
 * the notches still sweep 0 because they still curve inward.
 */
export function ticketClipPathPortrait(
  w = TICKET_P_W,
  h = TICKET_P_H,
  corner = CORNER_R,
  notch = NOTCH_R,
  perfY = PERF_Y,
): string {
  return [
    `M ${corner} 0`,
    // top edge
    `L ${w - corner} 0`,
    `A ${corner} ${corner} 0 0 1 ${w} ${corner}`,
    // right edge, above the notch
    `L ${w} ${perfY - notch}`,
    // right notch — bites left into the ticket
    `A ${notch} ${notch} 0 0 0 ${w} ${perfY + notch}`,
    // right edge, below the notch
    `L ${w} ${h - corner}`,
    `A ${corner} ${corner} 0 0 1 ${w - corner} ${h}`,
    // bottom edge
    `L ${corner} ${h}`,
    `A ${corner} ${corner} 0 0 1 0 ${h - corner}`,
    // left edge, below the notch
    `L 0 ${perfY + notch}`,
    // left notch — bites right into the ticket
    `A ${notch} ${notch} 0 0 0 0 ${perfY - notch}`,
    // left edge, above the notch
    `L 0 ${corner}`,
    `A ${corner} ${corner} 0 0 1 ${corner} 0`,
    "Z",
  ].join(" ");
}

export const TICKET_CLIP = `path("${ticketClipPath()}")`;
export const TICKET_CLIP_PORTRAIT = `path("${ticketClipPathPortrait()}")`;
