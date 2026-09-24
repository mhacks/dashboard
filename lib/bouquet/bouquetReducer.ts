import {
  SCENE,
  SLOTS,
  SLOTS_LEFT_TO_RIGHT,
  STICKER_BORDERS,
  flowerById,
  type Flower,
} from "./catalog";
import {
  baseRotationFor,
  clamp,
  leansWrongWay,
  type PlacedStem,
} from "./geometry";

/* Snapshot-based undo rather than inverse operations: the mutations here are
   small and varied (place, trash, reset, roll, vase swap, six tools), and an
   inverse for each is more code and more places to get subtly wrong. Copying
   four fields is cheap at this scale. */
export type Snapshot = {
  bouquet: PlacedStem[];
  order: string[]; // back-to-front render depth
  vaseId: string;
  selectedUid: string | null;
};

export type BouquetState = Snapshot & {
  borderColor: string;
  seq: number;
  past: Snapshot[];
  future: Snapshot[];
  lastKey: string | null;
  lastAt: number;
};

export type ToolId =
  "rotateL" | "rotateR" | "raise" | "lower" | "forward" | "back" | "flip";

export type Action =
  | { type: "place"; flowerId: string; at: number }
  | { type: "remove"; at: number }
  | { type: "select"; uid: string | null }
  | { type: "tool"; tool: ToolId; at: number }
  | { type: "setVase"; vaseId: string; at: number }
  | { type: "reset"; at: number }
  | {
      type: "roll";
      bouquet: PlacedStem[];
      order: string[];
      vaseId: string;
      seq: number;
      at: number;
    }
  | { type: "setBorder"; hex: string }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 80;
const COALESCE_MS = 700;

export const initialState: BouquetState = {
  bouquet: [],
  order: [],
  vaseId: "vase-floral",
  selectedUid: null,
  borderColor: STICKER_BORDERS[0].hex,
  seq: 0,
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
};

const snapshot = (s: BouquetState): Snapshot => ({
  bouquet: s.bouquet.map((x) => ({ ...x })),
  order: [...s.order],
  vaseId: s.vaseId,
  selectedUid: s.selectedUid,
});

/** Push history, coalescing runs of the same action within a short window. */
function commit(
  state: BouquetState,
  key: string | null,
  at: number,
  next: Snapshot,
): BouquetState {
  const merge =
    key !== null &&
    key === state.lastKey &&
    at - state.lastAt < COALESCE_MS &&
    state.past.length > 0;
  const past = merge ? state.past : [...state.past, snapshot(state)];
  return {
    ...state,
    ...next,
    past:
      past.length > HISTORY_LIMIT
        ? past.slice(past.length - HISTORY_LIMIT)
        : past,
    future: [], // a new action forks the timeline
    lastKey: key,
    lastAt: at,
  };
}

export function firstEmptySlot(bouquet: PlacedStem[]): number {
  const taken = new Set(bouquet.map((s) => s.slot));
  for (let i = 0; i < SCENE.maxStems; i++) if (!taken.has(i)) return i;
  return -1;
}

export function makeStem(
  flower: Flower,
  slot: number,
  seq: number,
  jitter?: { rot: number; height: number },
): PlacedStem {
  const def = SLOTS[slot];
  const flip = leansWrongWay(flower, def);
  const baseRot = baseRotationFor(flower, def, flip);
  const rotation = clamp(
    clamp(baseRot + (jitter ? jitter.rot : 0), baseRot - 30, baseRot + 30),
    -SCENE.maxRotation,
    SCENE.maxRotation,
  );
  return {
    uid: `u${seq}`,
    seq,
    flowerId: flower.id,
    slot,
    baseRot,
    rotation,
    height: clamp(jitter ? jitter.height : 1, 0.8, 1.2),
    flip,
  };
}

/* Slide a new stem back past anything its slot should sit behind, so outer
   slots land at the rear and the centre lands in front of them. */
export function insertByDepth(
  bouquet: PlacedStem[],
  order: string[],
  stem: PlacedStem,
): string[] {
  const slotZ = (uid: string) =>
    SLOTS[bouquet.find((s) => s.uid === uid)!.slot].z;
  let i = order.length;
  while (i > 0 && slotZ(order[i - 1]) > SLOTS[stem.slot].z) i--;
  const next = [...order];
  next.splice(i, 0, stem.uid);
  return next;
}

/** Contiguous run of slots in left-to-right order, centred, for a known count. */
export function contiguousSlots(n: number, rand = Math.random): number[] {
  const span = SLOTS_LEFT_TO_RIGHT.length - n;
  let start = Math.floor(span / 2);
  if (span % 2 === 1 && rand() < 0.5) start += 1;
  return SLOTS_LEFT_TO_RIGHT.slice(start, start + n);
}

function applyTool(
  stem: PlacedStem,
  tool: ToolId,
  order: string[],
): { stem: PlacedStem; order: string[] } {
  const cap = SCENE.maxRotation;
  const rotate = (d: number) => ({
    ...stem,
    rotation: clamp(
      clamp(stem.rotation + d, stem.baseRot - 30, stem.baseRot + 30),
      -cap,
      cap,
    ),
  });
  const resize = (d: number) => ({
    ...stem,
    height: Math.round(clamp(stem.height + d, 0.8, 1.2) * 100) / 100,
  });

  switch (tool) {
    case "rotateL":
      return { stem: rotate(-5), order };
    case "rotateR":
      return { stem: rotate(5), order };
    case "raise":
      return { stem: resize(0.05), order };
    case "lower":
      return { stem: resize(-0.05), order };
    case "forward":
    case "back": {
      const i = order.indexOf(stem.uid);
      const j = i + (tool === "forward" ? 1 : -1);
      if (i < 0 || j < 0 || j >= order.length) return { stem, order };
      const next = [...order];
      next.splice(j, 0, next.splice(i, 1)[0]);
      return { stem, order: next };
    }
    case "flip": {
      // mirroring inverts the lean, so the correction is recomputed — any
      // manual nudge the user dialled in is carried across
      const flip = !stem.flip;
      const nudge = stem.rotation - stem.baseRot;
      const baseRot = baseRotationFor(
        flowerById(stem.flowerId),
        SLOTS[stem.slot],
        flip,
      );
      return {
        stem: {
          ...stem,
          flip,
          baseRot,
          rotation: clamp(
            clamp(baseRot + nudge, baseRot - 30, baseRot + 30),
            -cap,
            cap,
          ),
        },
        order,
      };
    }
  }
}

export function bouquetReducer(
  state: BouquetState,
  action: Action,
): BouquetState {
  switch (action.type) {
    case "place": {
      const slot = firstEmptySlot(state.bouquet);
      if (slot < 0) return state;
      const seq = state.seq + 1;
      const stem = makeStem(flowerById(action.flowerId), slot, seq);
      const bouquet = [...state.bouquet, stem];
      return {
        ...commit(state, null, action.at, {
          bouquet,
          order: insertByDepth(bouquet, state.order, stem),
          vaseId: state.vaseId,
          selectedUid: stem.uid,
        }),
        seq,
      };
    }

    case "remove": {
      if (!state.selectedUid) return state;
      const uid = state.selectedUid;
      return commit(state, null, action.at, {
        bouquet: state.bouquet.filter((s) => s.uid !== uid),
        order: state.order.filter((u) => u !== uid),
        vaseId: state.vaseId,
        selectedUid: null,
      });
    }

    case "select":
      return { ...state, selectedUid: action.uid };

    case "tool": {
      const current = state.bouquet.find((s) => s.uid === state.selectedUid);
      if (!current) return state;
      const { stem, order } = applyTool(current, action.tool, state.order);
      return commit(state, `${action.tool}:${current.uid}`, action.at, {
        bouquet: state.bouquet.map((s) => (s.uid === stem.uid ? stem : s)),
        order,
        vaseId: state.vaseId,
        selectedUid: state.selectedUid,
      });
    }

    case "setVase": {
      if (action.vaseId === state.vaseId) return state;
      return commit(state, null, action.at, {
        bouquet: state.bouquet,
        order: state.order,
        vaseId: action.vaseId,
        selectedUid: state.selectedUid,
      });
    }

    case "reset":
      return commit(state, null, action.at, {
        bouquet: [],
        order: [],
        vaseId: state.vaseId,
        selectedUid: null,
      });

    case "roll":
      return {
        ...commit(state, null, action.at, {
          bouquet: action.bouquet,
          order: action.order,
          vaseId: action.vaseId,
          selectedUid: null,
        }),
        seq: action.seq,
      };

    case "setBorder":
      return { ...state, borderColor: action.hex };

    case "undo": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        ...prev,
        past: state.past.slice(0, -1),
        future: [...state.future, snapshot(state)],
        lastKey: null,
      };
    }

    case "redo": {
      if (!state.future.length) return state;
      const next = state.future[state.future.length - 1];
      return {
        ...state,
        ...next,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(0, -1),
        lastKey: null,
      };
    }
  }
}
