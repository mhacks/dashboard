// Recompresses the boarding pass art from the ticket studio's source repo into
// public/pass/. A one-shot, not a build step: these are static art assets that
// change roughly never, so the output is committed and this script only runs
// again if the source art does.
//
// Why it matters twice over. The backdrop picker paints every backdrop as a
// thumbnail on mount, and html-to-image base64s the selected backdrop and the
// theme's mark into the exported PNG on every download — so an oversized
// source file costs both page weight and export latency.
//
// The source art lives in the studio's original repo, which is not in this
// tree — clone it somewhere and point this at it:
//
//   git clone https://github.com/becccasun/mhacks-ticket-2026 /tmp/pass-art
//   node scripts/optimize-pass-assets.ts /tmp/pass-art
//
// It reads <repo>/public/{backdrops,marks} and writes public/pass/.

import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

import sharp, { type Sharp } from "sharp";

const sourceRepo = process.argv[2];
if (!sourceRepo) {
  console.error(
    "usage: node scripts/optimize-pass-assets.ts <path-to-mhacks-ticket-2026>",
  );
  process.exit(1);
}

const source = path.resolve(sourceRepo, "public");
const out = path.resolve("public/pass");

/**
 * The frame is at most 1080x1920 and the backdrop is `cover`, so nothing here
 * is upscaled by capping the long edge at 2048. Every current source file is
 * already under it; the cap exists so a future replacement can't quietly
 * double the page weight.
 */
const MAX_BACKDROP_EDGE = 2048;

/**
 * The mark renders at ~26 CSS px on the ticket and the ticket scales by at
 * most 2.44x into the portrait frame, so ~64 device px is the largest it is
 * ever rasterized at. 128 wide leaves 2x for retina previews and nothing more.
 */
const MARK_WIDTH = 128;

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

async function optimize(dir: string, transform: (pipeline: Sharp) => Sharp) {
  const from = path.join(source, dir);
  const to = path.join(out, dir);
  await mkdir(to, { recursive: true });

  let before = 0;
  let after = 0;

  for (const file of (await readdir(from)).sort()) {
    const input = path.join(from, file);
    const output = path.join(to, file);

    // toFile() cannot read and write the same path, and won't have to here —
    // but the pipeline is buffered anyway so a rerun against an already
    // optimized tree is safe.
    const { size } = await transform(sharp(input)).toFile(output);
    const original = (await stat(input)).size;

    before += original;
    after += size;
    console.log(`  ${dir}/${file}  ${kb(original)} → ${kb(size)}`);
  }

  console.log(`${dir}: ${kb(before)} → ${kb(after)}\n`);
  return { before, after };
}

const backdrops = await optimize("backdrops", (pipeline) =>
  pipeline
    .resize({
      width: MAX_BACKDROP_EDGE,
      height: MAX_BACKDROP_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    // Progressive so the picker's selected backdrop paints something early;
    // mozjpeg because these are photographic and it is meaningfully smaller
    // than libjpeg at the same perceptual quality.
    .jpeg({ quality: 72, progressive: true, mozjpeg: true }),
);

const marks = await optimize("marks", (pipeline) =>
  pipeline
    .resize({ width: MARK_WIDTH, withoutEnlargement: true })
    // Flat-colour logotypes on transparency — a palette PNG is lossless
    // enough here and roughly a fifth of the size.
    .png({ palette: true, compressionLevel: 9 }),
);

const before = backdrops.before + marks.before;
const after = backdrops.after + marks.after;
console.log(
  `total: ${kb(before)} → ${kb(after)} (${Math.round((1 - after / before) * 100)}% smaller)`,
);
