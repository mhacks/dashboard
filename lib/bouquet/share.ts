import { z } from "zod";
import { FLOWERS, SCENE, SLOTS, STICKER_BORDERS, VASES } from "./catalog";
import type { PlacedStem } from "./geometry";

/*
  The arrangement a hacker shares to the /live hero — exactly what
  renderSticker needs and nothing else. Checked against the catalog on the way
  in (the share action) and again on the way out (the /live query), since a
  row can be edited by hand in the Table Editor between the two.
*/

const flowerIds = FLOWERS.map((f) => f.id) as [string, ...string[]];
const vaseIds = VASES.map((v) => v.id) as [string, ...string[]];
const borderHexes = STICKER_BORDERS.map((b) => b.hex) as [string, ...string[]];

const sharedStemSchema = z.strictObject({
  uid: z.string().min(1).max(16),
  flowerId: z.enum(flowerIds),
  slot: z
    .number()
    .int()
    .min(0)
    .max(SLOTS.length - 1),
  rotation: z.number().min(-SCENE.maxRotation).max(SCENE.maxRotation),
  height: z.number().min(0.8).max(1.2),
  flip: z.boolean(),
});

export const sharedArrangementSchema = z
  .strictObject({
    vaseId: z.enum(vaseIds),
    borderColor: z.enum(borderHexes),
    stems: z.array(sharedStemSchema).min(1).max(SCENE.maxStems),
    order: z.array(z.string()),
  })
  .refine((a) => new Set(a.stems.map((s) => s.slot)).size === a.stems.length, {
    message: "Two stems share a slot",
    path: ["stems"],
  })
  .refine(
    (a) => {
      const uids = new Set(a.stems.map((s) => s.uid));
      return (
        uids.size === a.stems.length &&
        a.order.length === uids.size &&
        new Set(a.order).size === uids.size &&
        a.order.every((u) => uids.has(u))
      );
    },
    { message: "Order must list every stem once", path: ["order"] },
  );

export type SharedArrangement = z.infer<typeof sharedArrangementSchema>;

/** What /live gets per bouquet. */
export type SharedBouquet = {
  id: string;
  makerName: string;
  arrangement: SharedArrangement;
};

export function toSharedArrangement(
  stems: PlacedStem[],
  order: string[],
  vaseId: string,
  borderColor: string,
): SharedArrangement {
  return {
    vaseId,
    borderColor,
    order,
    stems: stems.map(({ uid, flowerId, slot, rotation, height, flip }) => ({
      uid,
      flowerId,
      slot,
      rotation,
      height,
      flip,
    })),
  };
}

/* renderSticker takes full PlacedStems; `seq` and `baseRot` only matter to
   the game's editing tools, never to drawing, so placeholders are fine. */
export function toPlacedStems(a: SharedArrangement): PlacedStem[] {
  return a.stems.map((s, i) => ({ ...s, seq: i, baseRot: s.rotation }));
}

/** "Rebecca Smith" → "Rebecca S."; empty when there is no first name. */
export function formatMakerName(firstName: string, lastName: string): string {
  const first = firstName.replace(/\s+/g, " ").trim().slice(0, 24);
  if (!first) return "";
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}
