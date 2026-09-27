// Renders the Apple and Google Wallet pass images under public/wallet/. A
// one-shot, not a build step: the output is committed. Rerun only if the source
// art changes:
//
//   node scripts/generate-wallet-assets.ts
//
// Sizes are Apple's event ticket dimensions, in points, at @1x/@2x/@3x:
//   icon        29×29    shown in notifications and Mail
//   logo        ≤160×50  top-left of the pass
//   thumbnail   90×90    beside the primary field
//   background  180×220  blurred by Wallet behind the whole front
//
// The Apple artwork comes from the "MHacks Check In" Pass Designer template,
// copied into scripts/wallet-art/. An event ticket with a background image
// can't also have a strip, so there is none.

import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const out = path.resolve("public/wallet/pass");
const googleOut = path.resolve("public/wallet/google");
const mark = path.resolve("public/pass/marks/mhacks-m-sky.png");
const ticketMark = path.resolve("scripts/wallet-art/ticket-mark.png");
const ticketBackground = path.resolve(
  "scripts/wallet-art/ticket-background.jpg",
);
const googleLogo = path.resolve("scripts/wallet-art/google-pass-logo.png");
const googleBanner = path.resolve("scripts/wallet-art/google-pass-banner.png");

/** The pass's backgroundColor, so the icon has no transparent corners. */
const PAPER = { r: 240, g: 247, b: 250, alpha: 1 };

await mkdir(out, { recursive: true });
await mkdir(googleOut, { recursive: true });

function suffix(scale: number) {
  return scale === 1 ? "" : `@${scale}x`;
}

for (const scale of [1, 2, 3]) {
  const size = 29 * scale;
  await sharp(mark)
    .resize(Math.round(size * 0.8), Math.round(size * 0.8), { fit: "inside" })
    .extend({
      top: Math.round(size * 0.1),
      bottom: Math.round(size * 0.1),
      left: Math.round(size * 0.1),
      right: Math.round(size * 0.1),
      background: PAPER,
    })
    .resize(size, size, { fit: "contain", background: PAPER })
    .flatten({ background: PAPER })
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, `icon${suffix(scale)}.png`));
}

// Google Wallet masks this square into a circle. The supplied artwork already
// keeps the M inside Google's 15% safe area; contain preserves its proportions
// while making the transparent canvas the required 660px square.
await sharp(googleLogo)
  .resize(660, 660, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ palette: true, quality: 100, compressionLevel: 9 })
  .toFile(path.join(googleOut, "logo.png"));

// Crop only the narrow excess at the sides to reach Google's recommended
// 1032×336 hero size without stretching the supplied banner.
await sharp(googleBanner)
  .resize(1032, 336, { fit: "cover", position: "centre" })
  .png({ palette: true, quality: 100, compressionLevel: 9 })
  .toFile(path.join(googleOut, "hero.png"));

// The template's mark is a 330px square with the M padded inside it; both the
// logo and the thumbnail keep that padding, as the template does.
for (const scale of [1, 2, 3]) {
  await sharp(ticketMark)
    .resize(50 * scale, 50 * scale)
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, `logo${suffix(scale)}.png`));
  await sharp(ticketMark)
    .resize(90 * scale, 90 * scale)
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, `thumbnail${suffix(scale)}.png`));
}

for (const scale of [1, 2, 3]) {
  await sharp(ticketBackground)
    .resize(180 * scale, 220 * scale, { fit: "cover", position: "centre" })
    // Wallet only takes PNG and blurs the background anyway, so a palette PNG
    // keeps the pass small for venue wifi at no visible cost.
    .png({ palette: true, quality: 80, compressionLevel: 9 })
    .toFile(path.join(out, `background${suffix(scale)}.png`));
}

console.log(`wrote Wallet pass images to ${path.relative(process.cwd(), out)}`);
