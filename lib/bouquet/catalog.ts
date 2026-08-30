/* ─────────────────────────────────────────────────────────────
   Catalog + scene geometry.

   `anchorX` / `ratio` are measured from each PNG's alpha bounds by
   tools/prep.py (in the source repo, becccasun/mhacks-bouquet). anchorX is
   where the cut stem end sits across the artwork's width — it is the
   rotation origin, and it is per-flower: these are hand-painted diagonal
   stems, so the values run from 0.26 to 0.97 and a shared 50% would swing
   most of them around a point that isn't on the stem.

   `stemHeight` is the rendered height in scene px at scale 1.0, tuned
   per flower so a spike and a blossom read at plausible relative sizes
   rather than all being normalised to one box.
   ───────────────────────────────────────────────────────────── */

export type CategoryId = "flowers" | "vases";

export type Flower = {
  id: string;
  name: string;
  category: "flowers";
  asset: string;
  cardColor: string;
  ratio: number; // width / height of the cropped art
  anchorX: number; // 0–1, where the cut stem end sits across the art
  stemHeight: number; // scene px at scale 1.0
};

export type Vase = {
  id: string;
  name: string;
  asset: string;
  cardColor: string;
  ratio: number;
  centreX: number; // body centre of mass, NOT the base centroid
  height: number;
  mouthHalf: number;
  sinkY: number;
};

export type Slot = {
  x: number; // multiple of the current vase's mouthHalf
  rot: number; // degrees
  z: number; // depth intent; lower = further back
  scale: number; // multiplier on stemHeight
  dy: number; // extra sink below the rim
};

export const CATEGORIES: CategoryId[] = ["flowers", "vases"];

export const FLOWERS: Flower[] = [
  {
    id: "trillium",
    name: "Trillium",
    category: "flowers",
    asset: "/assets/flowers/trillium.png",
    cardColor: "card-blue",
    ratio: 0.6805,
    anchorX: 0.818,
    stemHeight: 258,
  },

  {
    id: "wild-columbine",
    name: "Wild Columbine",
    category: "flowers",
    asset: "/assets/flowers/wild-columbine.png",
    cardColor: "card-cream",
    ratio: 0.5338,
    anchorX: 0.957,
    stemHeight: 278,
  },

  {
    id: "michigan-lily",
    name: "Michigan Lily",
    category: "flowers",
    asset: "/assets/flowers/michigan-lily.png",
    cardColor: "card-blue",
    ratio: 0.6208,
    anchorX: 0.967,
    stemHeight: 252,
  },

  {
    id: "black-eyed-susan",
    name: "Black-Eyed Susan",
    category: "flowers",
    asset: "/assets/flowers/black-eyed-susan.png",
    cardColor: "card-cream",
    ratio: 0.6497,
    anchorX: 0.261,
    stemHeight: 248,
  },

  {
    id: "dwarf-lake-iris",
    name: "Dwarf Lake Iris",
    category: "flowers",
    asset: "/assets/flowers/dwarf-lake-iris.png",
    cardColor: "card-blue",
    ratio: 0.5269,
    anchorX: 0.75,
    stemHeight: 232,
  },

  {
    id: "wild-bergamot",
    name: "Wild Bergamot",
    category: "flowers",
    asset: "/assets/flowers/wild-bergamot.png",
    cardColor: "card-cream",
    ratio: 0.4401,
    anchorX: 0.656,
    stemHeight: 272,
  },

  {
    id: "apple-blossom",
    name: "Apple Blossom",
    category: "flowers",
    asset: "/assets/flowers/apple-blossom.png",
    cardColor: "card-blue",
    ratio: 0.5697,
    anchorX: 0.75,
    stemHeight: 220,
  },

  {
    id: "wild-hyacinth",
    name: "Wild Hyacinth",
    category: "flowers",
    asset: "/assets/flowers/wild-hyacinth.png",
    cardColor: "card-cream",
    ratio: 0.2314,
    anchorX: 0.642,
    stemHeight: 272,
  },
];

/* Vases are opaque ceramic / knit, not glass, so there is no back+front
   pair — stems simply render behind the whole vase, which also means no
   clipping mask is needed at the mouth.

   `centreX` is the body's centre of mass so the pitcher isn't shoved
   off-centre by its handle.
   `sinkY` parks the cut ends just below the rim. Set deep inside the body
   it looks safe but isn't: rising that distance to the rim at angle θ
   displaces the stem sideways by sinkY*tan(θ) — tan, not sin — and the
   check must use SCENE.maxRotation rather than the slot default, because
   the rotate tool lets the user push past it:

     max|slot.x| * mouthHalf + sinkY * tan(maxRotation) < rim half-width

   Rim half-widths measured off the alpha at the sink depth and scaled to
   render size: floral 43, pitcher 43, knit 56. */
export const VASES: Vase[] = [
  {
    id: "vase-floral",
    name: "Floral",
    asset: "/assets/scene/vase-floral.png",
    cardColor: "card-blue",
    ratio: 0.6227,
    centreX: 0.487,
    height: 216,
    mouthHalf: 22,
    sinkY: 14,
  },
  {
    id: "vase-pitcher",
    name: "Pitcher",
    asset: "/assets/scene/vase-pitcher.png",
    cardColor: "card-cream",
    ratio: 1.0897,
    centreX: 0.56,
    height: 188,
    mouthHalf: 21,
    sinkY: 14,
  },
  {
    id: "vase-knit",
    name: "Knit",
    asset: "/assets/scene/vase-knit.png",
    cardColor: "card-blue",
    ratio: 0.7542,
    centreX: 0.495,
    height: 202,
    mouthHalf: 30,
    sinkY: 14,
  },
];

/* Slots as a fan; fill order is index order (centre, mid pair, low outer
   pair). Blooms land at roughly (angle, stem length) from a shared origin,
   so two stems collide whenever both are close. An early pass used a narrow
   ±27° spread and a tight 0.83–1.00 scale range, which put every head on
   nearly the same arc and piled up the middle. The spread and scale range
   are both stretched so heads stagger in angle and radius, and the pairs
   are deliberately not mirror-exact so it doesn't read machine-made. */
export const SLOTS: Slot[] = [
  { x: 0.0, rot: 0, z: 2, scale: 1.0, dy: 0 },
  { x: -0.55, rot: -20, z: 3, scale: 0.92, dy: 3 },
  { x: 0.55, rot: 21, z: 3, scale: 0.95, dy: 3 },
  { x: -1.0, rot: -40, z: 4, scale: 0.78, dy: 7 },
  { x: 1.0, rot: 40, z: 4, scale: 0.8, dy: 7 },
];

/* Slot indices in left-to-right screen order. Index order is centre-out,
   which keeps a partly-filled vase from opening a hole in the middle; this
   is the same slots sorted spatially, used to pick a contiguous run when
   the stem count is known up front (the random bouquet). */
export const SLOTS_LEFT_TO_RIGHT = [3, 1, 0, 2, 4];

/* Die-cut border options. All high-lightness and low-saturation on purpose:
   a vivid border competes with the art it surrounds, and the ink hairline
   stamped just outside it supplies the contrast. `sky` is the background
   tile face; `cream` is --paper, the original. */
export const STICKER_BORDERS = [
  { id: "cream", name: "cream", hex: "#F6EFE1" },
  { id: "sky", name: "sky", hex: "#E4EEF2" },
  { id: "sage", name: "sage", hex: "#DFE7D9" },
  { id: "blush", name: "blush", hex: "#F3E1DB" },
  { id: "lilac", name: "lilac", hex: "#E6E1EC" },
];

/* Linked from the export panel's caption ("decorate your MHacks ticket").
   The pass IS the ticket, and it has the bouquet slot the downloaded sticker
   is meant to go in — so this closes the loop that BOUQUET_GAME_URL in
   components/pass/bouquets.tsx opens in the other direction:
   pass → build a bouquet → download → back to the pass to upload it. */
export const TICKET_URL = "/dashboard/pass";

export const SCENE = {
  width: 789, // canvas coordinate space (the panel + rail take the rest)
  height: 720,
  stageWidth: 1280,
  seamY: 540, // tiles / table band boundary
  /* Where the vase actually stands. Capped by the canvas: the base plus its
     contact shadow must stay above `height`, so ~709 is the floor. */
  vaseBaseY: 700,
  maxRotation: 50, // hard ceiling, so no stem can lie down
  maxStems: SLOTS.length,
} as const;

export const flowerById = (id: string) => FLOWERS.find((f) => f.id === id)!;
export const vaseById = (id: string) => VASES.find((v) => v.id === id)!;
