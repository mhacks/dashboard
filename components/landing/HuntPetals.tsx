"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { pickPetal } from "@/lib/actions/hunt-petal.server.actions";

/*
  The last step of the puzzle hunt. Flower images on this page carry
  `data-hunt-flower="<id>"` (ids from lib/hunt/flowers.ts). A click on a petal
  of one asks the server whether it is the clicking hacker's flower; if so,
  their final code appears in a toast telling them to submit it with
  /submit-code in the MHacks Discord, the last step; the first hacker to do
  so wins and ends the hunt. A wrong flower locks petals for a while, and
  says so. Visitors who aren't in the hunt see nothing.

  The garlands stay pointer-events-none, so nothing underneath stops working:
  this listens on the document and works out from the click's position
  whether it landed on a flower image, then samples the pixels there.
*/

const TOAST_ID = "hunt-petal";

const minutes = (n: number) => (n === 1 ? "1 minute" : `${n} minutes`);

type Pixels = { data: Uint8ClampedArray; width: number; height: number };

/**
 * Each flower image's pixels, drawn whole once per source. Drawing it whole
 * matters: these come through the image optimizer with a srcset, so the
 * downloaded bitmap is not `naturalWidth` wide, and sampling a 1px slice of
 * the source lands somewhere else. The whole-image draw uses one consistent
 * size, which is the one read back here.
 */
const pixelCache = new Map<string, Pixels>();

function pixelsOf(img: HTMLImageElement): Pixels | null {
  const key = img.currentSrc || img.src;
  const cached = pixelCache.get(key);
  if (cached) return cached;
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const ctx = Object.assign(document.createElement("canvas"), {
    width,
    height,
  }).getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = {
    data: ctx.getImageData(0, 0, width, height).data,
    width,
    height,
  };
  pixelCache.set(key, pixels);
  return pixels;
}

/** One pixel of the image, at a point given as fractions of its size. */
function sample(pixels: Pixels, fx: number, fy: number) {
  if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) return null;
  const i =
    (Math.floor(fy * pixels.height) * pixels.width +
      Math.floor(fx * pixels.width)) *
    4;
  return pixels.data.subarray(i, i + 4);
}

/**
 * How far from the click a petal still counts. The garlands sway with a
 * slight rotation about one end, so mapping the click straight into the image
 * can be off by up to ~20px at the far end, and by a different amount every
 * moment. Searching this radius means a click on a petal is never missed; the
 * cost is that a click on the stem right beside a petal also counts.
 */
const RADIUS_PX = 21;
const STEP_PX = 3;

/** Whether the click at (x, y) landed on (or right beside) a petal of this image. */
function hitsPetal(img: HTMLImageElement, x: number, y: number) {
  if (!img.complete || !img.naturalWidth) return false;
  const rect = img.getBoundingClientRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    return false;
  }
  // The landing sections are sheets that overlap and clip their own content,
  // so a flower can be inside its box yet covered by the next sheet or cut
  // off. Only count it if what's on top at that spot is the flower's own
  // section. (elementFromPoint skips the pointer-events-none garland itself.)
  const section = img.closest("section");
  const onTop = document.elementFromPoint(x, y);
  if (section && (!onTop || !section.contains(onTop))) return false;

  const pixels = pixelsOf(img);
  if (!pixels) return false;
  for (let dy = -RADIUS_PX; dy <= RADIUS_PX; dy += STEP_PX) {
    for (let dx = -RADIUS_PX; dx <= RADIUS_PX; dx += STEP_PX) {
      if (dx * dx + dy * dy > RADIUS_PX * RADIUS_PX) continue;
      const pixel = sample(
        pixels,
        (x + dx - rect.left) / rect.width,
        (y + dy - rect.top) / rect.height,
      );
      if (pixel && isPetal(pixel)) return true;
    }
  }
  return false;
}

/**
 * Petal, not stem or leaf: solid, not green, and not the near-black centre of
 * a black-eyed Susan. The art's stems and leaves are all green, and its
 * petals pink, white, cream, orange or violet, so colour is enough.
 */
function isPetal([r, g, b, a]: Uint8ClampedArray) {
  if (a < 160) return false;
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  if (lightness < 0.3) return false;
  const delta = max - min;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (saturation < 0.15) return true; // white and cream petals
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  let hue =
    max === R
      ? ((G - B) / delta) % 6
      : max === G
        ? (B - R) / delta + 2
        : (R - G) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return hue < 65 || hue > 170;
}

export function HuntPetals() {
  useEffect(() => {
    let pending = false;

    async function onClick(event: MouseEvent) {
      if (pending) return;
      const flowers = document.querySelectorAll<HTMLImageElement>(
        "img[data-hunt-flower]",
      );
      for (const img of flowers) {
        let hit: boolean;
        try {
          hit = hitsPetal(img, event.clientX, event.clientY);
        } catch {
          continue; // a canvas the browser won't read; never a petal
        }
        if (!hit) continue;

        pending = true;
        try {
          const result = await pickPetal(img.dataset.huntFlower);
          if (result.status === "found") {
            const code = result.code;
            // The last step: there is no page after this, so the toast says
            // what to do with the code and stays until they close it.
            toast.success("You picked the right petal.", {
              id: TOAST_ID,
              description: `Your code: ${code}. Submit it with /submit-code in the MHacks Discord. The first hacker to do so wins!`,
              duration: Infinity,
              action: {
                label: "Copy code",
                onClick: (event) => {
                  // Sonner closes the toast on action by default; keep it.
                  event.preventDefault();
                  void navigator.clipboard?.writeText(code);
                },
              },
            });
          } else if (result.status === "wrong") {
            toast.error("Not this flower.", {
              id: TOAST_ID,
              description: `The petals close for ${minutes(result.minutes)}. Read your riddle again.`,
              duration: 10_000,
            });
          } else if (result.status === "ended") {
            toast("The scavenger hunt has ended.", {
              id: TOAST_ID,
              description: "Someone has already won. Thanks for playing!",
              duration: 10_000,
            });
          } else if (result.status === "locked") {
            toast("The petals are still closed.", {
              id: TOAST_ID,
              description: `Try again in ${minutes(result.minutes)}.`,
              duration: 6_000,
            });
          }
        } finally {
          pending = false;
        }
        return;
      }
    }

    document.addEventListener("click", onClick, { passive: true });
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
