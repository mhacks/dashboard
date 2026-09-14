import qrcode from "qrcode-generator";

/** The spec's quiet zone, in modules. Scanners need it — do not shrink it. */
export const QR_QUIET_ZONE = 4;

export type QrMatrix = {
  /** Modules per side, excluding the quiet zone. */
  size: number;
  /** SVG path data in module units, with the origin at the matrix corner. */
  path: string;
};

/**
 * Encodes `value` and returns it as one SVG path, in module units — the caller
 * scales it with a viewBox rather than baking pixel sizes in here.
 *
 * Synchronous and dependency-free on purpose: this runs in a server component
 * so the finished `<svg>` ships inside the HTML. A hacker's phone that loses
 * the venue wifi after the page paints can still open their code, which is not
 * true of anything that has to hydrate first.
 *
 * Error correction defaults to "M". A 36-character UUID lands on version 3
 * (29x29) at either L or M, so the stronger correction costs nothing in module
 * count and buys forgiveness for glare on a phone screen under a hall light.
 */
export function qrPath(
  value: string,
  ecc: "L" | "M" | "Q" | "H" = "M",
): QrMatrix {
  const qr = qrcode(0, ecc); // 0 = pick the smallest version that fits
  qr.addData(value);
  qr.make();

  const size = qr.getModuleCount();
  const parts: string[] = [];

  // One subpath per horizontal run of dark modules rather than one per module.
  // At 29x29 that is ~90 path commands instead of ~420 elements, which keeps
  // the RSC payload small enough that inlining the code is genuinely cheaper
  // than fetching an image.
  for (let row = 0; row < size; row++) {
    let run = 0;
    for (let col = 0; col <= size; col++) {
      if (col < size && qr.isDark(row, col)) {
        run++;
        continue;
      }
      if (run > 0) parts.push(`M${col - run} ${row}h${run}v1h-${run}z`);
      run = 0;
    }
  }

  return { size, path: parts.join("") };
}
