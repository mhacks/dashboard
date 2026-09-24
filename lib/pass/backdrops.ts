import type { BackdropId } from "@/lib/pass/types";
import { asset } from "@/lib/landing/asset";

export type BackdropDef = {
  id: BackdropId;
  label: string;
  src: string;
  /** Shown under the label in the picker. */
  note: string;
};

/*
  The backing the pass sits on in the exported frame. This is where the colour
  and character live — the interface around it stays neutral so these read
  clearly and nothing competes with them.
*/
export const BACKDROPS: BackdropDef[] = [
  {
    id: "halftone",
    label: "Halftone",
    src: asset("/pass/backdrops/backdrop-halftone.jpg"),
    note: "screened foliage",
  },
  {
    id: "sky",
    label: "Sky",
    src: asset("/pass/backdrops/sky-binary.jpg"),
    note: "binary cloud",
  },
  {
    id: "grove",
    label: "Grove",
    src: asset("/pass/backdrops/backdrop-grove.jpg"),
    note: "solarized green",
  },
  {
    id: "blossom",
    label: "Blossom",
    src: asset("/pass/backdrops/backdrop-blossom.jpg"),
    note: "ascii bloom",
  },
  {
    id: "fern",
    label: "Fern",
    src: asset("/pass/backdrops/backdrop-fern.jpg"),
    note: "stippled leaves",
  },
];

export const DEFAULT_BACKDROP: BackdropId = "halftone";

export function backdropDef(id: BackdropId): BackdropDef {
  return BACKDROPS.find((b) => b.id === id) ?? BACKDROPS[0];
}
