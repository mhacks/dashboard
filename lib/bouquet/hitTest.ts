import { flowerById, vaseById } from "./catalog";
import { getAlphaMap } from "./images";
import { stemGeometry, type PlacedStem } from "./geometry";

const TOL = 4; // scene px of slop, so thin stems stay grabbable

/* Inverts the stem's rotate + flip about its cut end, maps into image space,
   and samples the alpha map. Hit targets follow the paint, so clicking the gap
   between two petals selects whatever is actually behind it. */
export function pointInStem(
  stem: PlacedStem,
  vaseId: string,
  px: number,
  py: number,
): boolean {
  const f = flowerById(stem.flowerId);
  const g = stemGeometry(stem, vaseById(vaseId));

  const t = (-stem.rotation * Math.PI) / 180;
  const dx = px - g.ax;
  const dy = py - g.ay;
  let lx = dx * Math.cos(t) - dy * Math.sin(t);
  const ly = dx * Math.sin(t) + dy * Math.cos(t);
  if (stem.flip) lx = -lx;

  const ix = f.anchorX * g.w + lx;
  const iy = g.h + ly;
  if (ix < -TOL || ix > g.w + TOL || iy < -TOL || iy > g.h + TOL) return false;

  const map = getAlphaMap(f.id);
  if (!map) return ix >= 0 && ix <= g.w && iy >= 0 && iy <= g.h;

  const sx = (ix / g.w) * map.w;
  const sy = (iy / g.h) * map.h;
  const rx = Math.max(1, Math.round((TOL / g.w) * map.w));
  const ry = Math.max(1, Math.round((TOL / g.h) * map.h));
  for (let oy = -ry; oy <= ry; oy++) {
    for (let ox = -rx; ox <= rx; ox++) {
      const cx = Math.round(sx + ox);
      const cy = Math.round(sy + oy);
      if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) continue;
      if (map.data[cy * map.w + cx] > 60) return true;
    }
  }
  return false;
}

/** Front-to-back, so the topmost stem under the cursor wins. */
export function hitTest(
  stems: PlacedStem[],
  order: string[],
  vaseId: string,
  px: number,
  py: number,
): PlacedStem | null {
  for (let i = order.length - 1; i >= 0; i--) {
    const s = stems.find((x) => x.uid === order[i]);
    if (s && pointInStem(s, vaseId, px, py)) return s;
  }
  return null;
}
