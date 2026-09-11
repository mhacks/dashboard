import { FLOWERS, VASES } from "./catalog";

export type AlphaMap = { w: number; h: number; data: Uint8Array };

/* Decoded bitmaps are kept (not just their alpha maps) because the export
   step redraws the whole arrangement onto a canvas. */
const images = new Map<string, HTMLImageElement>();
const alphaMaps = new Map<string, AlphaMap>();

let loadPromise: Promise<void> | null = null;
let alphaAvailable = true;

export const getImage = (id: string) => images.get(id);
export const getAlphaMap = (id: string) => alphaMaps.get(id);
export const isAlphaAvailable = () => alphaAvailable;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

/* Hit targets are the painted pixels, not a bounding box, so each flower gets
   a downscaled copy of its alpha channel. A canvas drawn from a cross-origin
   image is tainted and getImageData throws; served from /public that can't
   happen, but the fallback keeps the app usable if it ever does. */
function buildAlphaMap(id: string, img: HTMLImageElement) {
  const cap = 240;
  const s = Math.min(1, cap / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(img, 0, 0, w, h);
  try {
    const px = ctx.getImageData(0, 0, w, h).data;
    const data = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) data[i] = px[i * 4 + 3];
    alphaMaps.set(id, { w, h, data });
  } catch {
    if (alphaAvailable) {
      alphaAvailable = false;
      console.warn(
        "Alpha hit-testing unavailable (tainted canvas); falling back to bounding boxes.",
      );
    }
  }
}

/** Idempotent: safe to call from every mount, resolves once everything is decoded. */
export function loadAssets(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all([
    ...FLOWERS.map((f) =>
      loadImage(f.asset).then((img) => {
        images.set(f.id, img);
        buildAlphaMap(f.id, img);
      }),
    ),
    ...VASES.map((v) =>
      loadImage(v.asset).then((img) => images.set(v.id, img)),
    ),
  ])
    .then(() => undefined)
    .catch((err) => {
      console.error(err);
    });
  return loadPromise;
}
