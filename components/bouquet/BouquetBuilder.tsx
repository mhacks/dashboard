"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { FLOWERS, SCENE, VASES, type CategoryId } from "@/lib/bouquet/catalog";
import {
  bouquetReducer,
  contiguousSlots,
  firstEmptySlot,
  initialState,
  insertByDepth,
  makeStem,
  type ToolId,
} from "@/lib/bouquet/bouquetReducer";
import type { PlacedStem } from "@/lib/bouquet/geometry";
import { loadAssets } from "@/lib/bouquet/images";
import InventoryPanel from "./InventoryPanel";
import ToolRail from "./ToolRail";
import Scene from "./Scene";
import ExportPanel from "./ExportPanel";

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

/* Next SSRs this client component, and useLayoutEffect is a no-op (with a
   console warning) on the server. Falling back to useEffect there is safe —
   the fallback branch never runs in the browser, where the layout-effect
   timing actually matters. */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BouquetBuilder() {
  const [state, dispatch] = useReducer(bouquetReducer, initialState);
  const [activeTab, setActiveTab] = useState<CategoryId>("flowers");
  const [hoveredUid, setHoveredUid] = useState<string | null>(null);
  const [wrapped, setWrapped] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [tip, setTip] = useState<{ text: string; top: number } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadAssets();
  }, []);

  /* fixed 1280×720 design, scaled to fit — this is a game screen, not a
     responsive page. useLayoutEffect (not useEffect) so the scale is set
     before the browser's first paint — otherwise #stage briefly paints at
     its native, unscaled size and visibly snaps to the fitted size a frame
     later. */
  useIsomorphicLayoutEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      const s = Math.min(
        window.innerWidth / SCENE.stageWidth,
        window.innerHeight / SCENE.height,
      );
      el.style.transform = `scale(${s})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /* ── actions ── */
  const placeFlower = useCallback(
    (flowerId: string) => {
      if (firstEmptySlot(state.bouquet) < 0) return false;
      dispatch({ type: "place", flowerId, at: now() });
      return true;
    },
    [state.bouquet],
  );

  const randomBouquet = useCallback(() => {
    setConfirmReset(false);
    const vaseId = VASES[Math.floor(Math.random() * VASES.length)].id;
    // 3–5 stems: a full vase every time reads as a preset, not a roll.
    const n = Math.round(3 + Math.random() * (SCENE.maxStems - 3));
    // sampled without replacement — three of the same flower isn't "random"
    const chosen = shuffled(FLOWERS).slice(0, n);
    // a CONTIGUOUS centred run of slots, not 0..n-1: the count is known up
    // front here, so the fan can stay solid instead of leaving an inner gap
    const slots = contiguousSlots(n);

    let seq = state.seq;
    const bouquet: PlacedStem[] = [];
    let order: string[] = [];
    slots.forEach((slot, i) => {
      seq += 1;
      const stem = makeStem(chosen[i], slot, seq, {
        rot: -7 + Math.random() * 14,
        height: 0.86 + Math.random() * 0.28,
      });
      bouquet.push(stem);
      order = insertByDepth(bouquet, order, stem);
    });
    dispatch({ type: "roll", bouquet, order, vaseId, seq, at: now() });
  }, [state.seq]);

  const applyTool = useCallback((tool: ToolId) => {
    dispatch({ type: "tool", tool, at: now() });
  }, []);

  /* ── keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey; // ⌘ on mac, ctrl elsewhere
      const key = e.key.toLowerCase(); // shift+z arrives as 'Z'
      if (mod && key === "z") {
        e.preventDefault();
        if (!wrapped) dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        if (!wrapped) dispatch({ type: "redo" });
        return;
      }
      if (wrapped) return;
      if (e.key === "Escape") {
        dispatch({ type: "select", uid: null });
        setConfirmReset(false);
      }
      if ((e.key === "Backspace" || e.key === "Delete") && state.selectedUid) {
        e.preventDefault();
        dispatch({ type: "remove", at: now() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wrapped, state.selectedUid]);

  /* Tooltip is positioned past the RAIL's right edge, not the button's: the
     buttons are inset in the 56px rail, so button-relative placement left the
     pill straddling the panel/canvas seam. */
  const handleTip = useCallback(
    (text: string | null, el: HTMLElement | null) => {
      if (!text || !el || !stageRef.current) {
        setTip(null);
        return;
      }
      const sr = stageRef.current.getBoundingClientRect();
      const scale = sr.width / SCENE.stageWidth;
      const br = el.getBoundingClientRect();
      setTip({ text, top: (br.top + br.height / 2 - sr.top) / scale });
    },
    [],
  );

  const selectedStem = state.bouquet.find((s) => s.uid === state.selectedUid);

  return (
    <div id="viewport" className="bouquet-app">
      <div
        id="stage"
        ref={stageRef}
        className={wrapped ? "wrapped" : ""}
        // The blocking script below sets `style.transform` before hydration
        // runs, same technique next-themes uses on <html> in app/layout.tsx
        // for the dark-mode flash. React never renders a `style` prop here,
        // so it has nothing to reconcile that attribute against — without
        // this, React logs a hydration-mismatch warning for an attribute it
        // was never going to own in the first place.
        suppressHydrationWarning
      >
        {/* The layout effect below can't stop the flash on its own: the
            server has no idea how big the browser window is, so it renders
            #stage with no transform, and the browser paints that raw HTML
            the instant it arrives — before the JS bundle has even finished
            loading, let alone hydrated. This blocking script runs while the
            HTML is still being parsed, before that first paint, so the
            correct scale is already applied when the page becomes visible.
            Same technique next-themes uses in app/layout.tsx to avoid a
            dark/light flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var el = document.getElementById('stage');
              if (!el) return;
              var s = Math.min(window.innerWidth / ${SCENE.stageWidth}, window.innerHeight / ${SCENE.height});
              el.style.transform = 'scale(' + s + ')';
            })();`,
          }}
        />
        <InventoryPanel
          count={state.bouquet.length}
          activeTab={activeTab}
          onTab={setActiveTab}
          vaseId={state.vaseId}
          onPickVase={(id) =>
            dispatch({ type: "setVase", vaseId: id, at: now() })
          }
          onPlaceFlower={placeFlower}
          onRandom={randomBouquet}
          onReset={() =>
            setConfirmReset((o) => (state.bouquet.length ? !o : false))
          }
          resetOpen={confirmReset}
        />

        <ToolRail
          enabled={!!selectedStem}
          onTool={applyTool}
          onRemove={() => dispatch({ type: "remove", at: now() })}
          onTip={handleTip}
        />

        <Scene
          bouquet={state.bouquet}
          order={state.order}
          vaseId={state.vaseId}
          selectedUid={state.selectedUid}
          hoveredUid={hoveredUid}
          wrapped={wrapped}
          onSelect={(uid) => {
            dispatch({ type: "select", uid });
            setConfirmReset(false);
          }}
          onHover={setHoveredUid}
        >
          <button
            className="wrap-btn"
            disabled={state.bouquet.length === 0}
            onClick={() => {
              setWrapped(true);
              dispatch({ type: "select", uid: null });
            }}
          >
            wrap &rarr;
          </button>

          <ExportPanel
            open={wrapped}
            bouquet={state.bouquet}
            order={state.order}
            vaseId={state.vaseId}
            borderColor={state.borderColor}
            onBorder={(hex) => dispatch({ type: "setBorder", hex })}
            onBack={() => setWrapped(false)}
            onRestart={() => {
              setWrapped(false);
              dispatch({ type: "reset", at: now() });
            }}
          />
        </Scene>

        {confirmReset && (
          <div className="popover confirm">
            <p>clear the whole bouquet?</p>
            <div className="confirm-row">
              <button
                className="pill ghost"
                onClick={() => setConfirmReset(false)}
              >
                keep it
              </button>
              <button
                className="pill solid"
                onClick={() => {
                  dispatch({ type: "reset", at: now() });
                  setConfirmReset(false);
                }}
              >
                clear
              </button>
            </div>
          </div>
        )}

        {tip && (
          <div className="tip on" style={{ top: tip.top }}>
            {tip.text}
          </div>
        )}
        <div
          className="grain"
          aria-hidden="true"
          style={{ backgroundImage: `url(/assets/texture/paper-grain.png)` }}
        />
      </div>
    </div>
  );
}
