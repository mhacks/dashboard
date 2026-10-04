"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { pickPetal } from "@/lib/actions/hunt-petal.server.actions";

/*
  The last step of the puzzle hunt. Flower images on this page carry
  `data-hunt-flower="<id>"` (ids from lib/hunt/flowers.ts). A click on a petal
  of one asks the server whether it is the clicking hacker's flower; if so,
  their final code appears in a toast. For everyone else nothing happens.

  The garlands stay pointer-events-none, so nothing underneath stops working:
  this listens on the document and works out from the click's position
  whether it landed on a flower image, then samples that one pixel.
*/

const TOAST_ID = "hunt-petal";

let pixelCanvas: CanvasRenderingContext2D | null = null;

/** The clicked pixel of the image, or null if the click missed it. */
function pixelAt(img: HTMLImageElement, x: number, y: number) {
  const rect = img.getBoundingClientRect();
  if (
    !img.complete ||
    !img.naturalWidth ||
    x < rect.left ||
    x > rect.right ||
    y < rect.top ||
    y > rect.bottom
  ) {
    return null;
  }
  pixelCanvas ??= Object.assign(document.createElement("canvas"), {
    width: 1,
    height: 1,
  }).getContext("2d", { willReadFrequently: true });
  if (!pixelCanvas) return null;

  const sx = ((x - rect.left) / rect.width) * img.naturalWidth;
  const sy = ((y - rect.top) / rect.height) * img.naturalHeight;
  pixelCanvas.clearRect(0, 0, 1, 1);
  pixelCanvas.drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
  return pixelCanvas.getImageData(0, 0, 1, 1).data;
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
        let pixel: Uint8ClampedArray | null;
        try {
          pixel = pixelAt(img, event.clientX, event.clientY);
        } catch {
          continue; // a canvas the browser won't read; never a petal
        }
        if (!pixel || !isPetal(pixel)) continue;

        pending = true;
        try {
          const { code } = await pickPetal(img.dataset.huntFlower);
          if (code) {
            toast.success("You picked the right petal.", {
              id: TOAST_ID,
              description: `Your code: ${code}`,
              duration: Infinity,
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
