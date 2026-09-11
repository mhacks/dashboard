import {
  SCENE,
  SLOTS,
  type Flower,
  type Slot,
  type Vase,
  flowerById,
  vaseById,
} from "./catalog";

export type PlacedStem = {
  uid: string;
  seq: number;
  flowerId: string;
  slot: number;
  baseRot: number; // lean-corrected slot angle; the rotate tool clamps ±30 around this
  rotation: number;
  height: number; // 0.8–1.2 multiplier
  flip: boolean;
};

export type StemGeometry = {
  w: number;
  h: number; // rendered size in scene px
  ax: number;
  ay: number; // the stem's cut end — its rotation origin
};

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/* How far a flower's bloom sits off the vertical from its own cut end. The
   head is at the top-centre of the art and the stem base at anchorX, so the
   offset is atan((0.5 - anchorX) * ratio). Negative = head to the left. */
export function naturalLean(flower: Flower): number {
  return (Math.atan((0.5 - flower.anchorX) * flower.ratio) * 180) / Math.PI;
}

/* Every flower is painted leaning one way. Dropped into a slot on the
   matching side it fans outward; on the wrong side it folds back across the
   centre and buries whatever is already there. */
export function leansWrongWay(flower: Flower, slot: Slot): boolean {
  if (slot.x === 0) return false;
  const headIsLeft = flower.anchorX > 0.5;
  return slot.x < 0 ? !headIsLeft : headIsLeft;
}

/* The slot fan defines the angles blooms should occupy. Left uncorrected each
   stem also carries its own lean on top of that — and seven of the eight
   flowers lean LEFT, by up to 16°. Every bloom therefore drifted left of its
   slot, the arrangement bunched to one side, and the right of the fan went
   bald. Subtracting the lean puts the bloom where the slot asked for it. */
export function baseRotationFor(
  flower: Flower,
  slot: Slot,
  flip: boolean,
): number {
  const lean = naturalLean(flower) * (flip ? -1 : 1);
  return clamp(slot.rot - lean, -SCENE.maxRotation, SCENE.maxRotation);
}

export function stemGeometry(stem: PlacedStem, vase: Vase): StemGeometry {
  const f = flowerById(stem.flowerId);
  const slot = SLOTS[stem.slot];
  const h = f.stemHeight * slot.scale * stem.height;
  return {
    w: h * f.ratio,
    h,
    ax: SCENE.width / 2 + slot.x * vase.mouthHalf,
    ay: SCENE.vaseBaseY - vase.height + vase.sinkY + slot.dy,
  };
}

/** The four corners of a stem's art rect, transformed into scene space. */
export function stemCorners(
  stem: PlacedStem,
  g: StemGeometry,
): [number, number][] {
  const f = flowerById(stem.flowerId);
  const t = (stem.rotation * Math.PI) / 180;
  const cos = Math.cos(t),
    sin = Math.sin(t);
  const sx = stem.flip ? -1 : 1;
  return (
    [
      [-f.anchorX * g.w, -g.h],
      [(1 - f.anchorX) * g.w, -g.h],
      [-f.anchorX * g.w, 0],
      [(1 - f.anchorX) * g.w, 0],
    ] as [number, number][]
  ).map(([x, y]) => {
    const fx = x * sx;
    return [g.ax + fx * cos - y * sin, g.ay + fx * sin + y * cos] as [
      number,
      number,
    ];
  });
}

/** Scene point of the art's top-edge midpoint — roughly where the bloom is. */
export function bloomPoint(
  stem: PlacedStem,
  g: StemGeometry,
): [number, number] {
  const f = flowerById(stem.flowerId);
  const t = (stem.rotation * Math.PI) / 180;
  const cos = Math.cos(t),
    sin = Math.sin(t);
  const sx = stem.flip ? -1 : 1;
  const x = (0.5 - f.anchorX) * g.w * sx;
  const y = -g.h;
  return [g.ax + x * cos - y * sin, g.ay + x * sin + y * cos];
}

/** Painted extent of the whole arrangement, in scene coordinates. Assets are
 *  cropped to their alpha bounds, so the art rect is the art. */
export function arrangementBounds(stems: PlacedStem[], vaseId: string) {
  const v = vaseById(vaseId);
  const vw = v.height * v.ratio;
  let top = SCENE.vaseBaseY - v.height;
  let left = SCENE.width / 2 - v.centreX * vw;
  let right = SCENE.width / 2 + (1 - v.centreX) * vw;

  for (const s of stems) {
    for (const [X, Y] of stemCorners(s, stemGeometry(s, v))) {
      if (Y < top) top = Y;
      if (X < left) left = X;
      if (X > right) right = X;
    }
  }
  return { top, left, right };
}
