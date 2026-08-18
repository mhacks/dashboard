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
import { useMediaQuery } from "@/hooks/use-media-query";
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

// Same breakpoint app/dashboard/pass/pass-client.tsx uses for its own
// desktop/mobile split — reused rather than invented, so the two don't
// drift apart.
const DESKTOP = "(min-width: 1024px)";

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

  // Starts `false` (see the hook's own doc comment — no `window` on the
  // server) and corrects itself in an effect on the first client pass, same
  // as pass-client.tsx's `isDesktop`. Only consumed as a `data-mobile`
  // attribute for now — CSS doesn't branch on it yet (that's step 2).
  const isMobile = !useMediaQuery(DESKTOP);

  useEffect(() => {
    void loadAssets();
  }, []);

  /* DESKTOP ONLY: the fixed 1280×720 diorama scaled to fit the window — a
     game screen, not a responsive page. useLayoutEffect (not useEffect) so
     the scale is set before the browser's first paint, otherwise #stage
     briefly paints at its native size and snaps a frame later.

     The mobile layout must NOT get this transform. It's a normal
     full-width column that sizes itself in CSS, and scaling it by the
     desktop fit factor shrinks the entire stack to a fraction of the
     viewport, leaving it stranded in the middle of the background. The
     breakpoint is re-read inside `fit` (not taken from the `isMobile`
     state) so a resize across 1024px is handled by the same listener,
     with no re-subscribe — and crossing to mobile actively *clears* any
     transform a previous desktop pass left behind. */
  useIsomorphicLayoutEffect(() => {
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      if (!window.matchMedia(DESKTOP).matches) {
        el.style.transform = "";
        return;
      }
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

  /* Ride the page back up, THEN wrap. Order matters and is the whole reason
     this isn't a one-liner in an effect.

     Below ~700px wrapping hides the scene, tool rail and catalog, which
     collapses the document from ~1470px to the ~466px card — shorter than
     the viewport. The browser clamps scrollY to 0 synchronously with that
     layout change, so a scroll fired after the state update has nothing left
     to travel through and reads as an instant jump. Scrolling first, while
     the tall builder is still in flow, is what makes the movement visible.

     `settled` guards against the three finishers racing: the position check
     wins normally, `scrollend` covers browsers that fire it, and the timeout
     guarantees the wrap still happens if a scroll event never arrives (an
     interrupted or already-satisfied scroll). Whichever lands first wins;
     the rest are torn down.

     prefers-reduced-motion jumps instead — an unrequested smooth scroll is
     exactly what that setting exists to suppress — and a user already at the
     top skips straight through with no delay. */
  const wrapUp = useCallback(() => {
    dispatch({ type: "select", uid: null });

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (window.scrollY <= 0 || reduced) {
      if (window.scrollY > 0) window.scrollTo({ top: 0 });
      setWrapped(true);
      return;
    }

    let settled = false;
    let timer = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", finish);
      window.clearTimeout(timer);
      setWrapped(true);
    };
    const onScroll = () => {
      if (window.scrollY <= 0) finish();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", finish);
    timer = window.setTimeout(finish, 800);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* Tooltip is positioned past the RAIL's right edge, not the button's: the
     buttons are inset in the 56px rail, so button-relative placement left the
     pill straddling the panel/canvas seam. */
  const handleTip = useCallback(
    (text: string | null, el: HTMLElement | null) => {
      if (!text || !el || !stageRef.current) {
        setTip(null);
        return;
      }
      /* Desktop only, on two counts. It's a hover affordance, and touch has
         no hover — but mobile browsers still synthesise mouseenter on tap, so
         without this guard it really would appear. And both of its
         coordinates are desktop-specific: the pill is pinned at `left: 499px`
         (past the 435px panel + 56px rail, a layout that only exists above
         1024px), which on a 320px screen puts it ~180px off the right edge
         and drags the page into horizontal scroll — and the `top` below
         divides by the stage's fit scale, which mobile deliberately does not
         apply, throwing the vertical position out by the same factor. The
         buttons carry aria-labels, so nothing is lost. */
      if (!window.matchMedia(DESKTOP).matches) {
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
    <div
      id="viewport"
      className="bouquet-app"
      data-mobile={isMobile || undefined}
    >
      <div
        id="stage"
        ref={stageRef}
        className={wrapped ? "wrapped" : ""}
        data-mobile={isMobile || undefined}
        // The blocking script below sets `style.transform` before hydration
        // runs, same technique next-themes uses on <html> in app/layout.tsx
        // for the dark-mode flash. React never renders a `style` prop here,
        // so it has nothing to reconcile that attribute against — without
        // this, React logs a hydration-mismatch warning for an attribute it
        // was never going to own in the first place.
        suppressHydrationWarning
      >
        {/* The layout effect above can't stop the flash on its own: the
            server has no idea how big the browser window is, so it renders
            #stage with no transform, and the browser paints that raw HTML
            the instant it arrives — before the JS bundle has even finished
            loading, let alone hydrated. This blocking script runs while the
            HTML is still being parsed, before that first paint, so the
            correct scale is already applied when the page becomes visible.
            Same technique next-themes uses in app/layout.tsx to avoid a
            dark/light flash.

            Gated on the same 1024px breakpoint as the effect, and for the
            same reason: on mobile there is no fixed diorama to fit, so
            applying the desktop scale here shrinks the entire column to a
            fraction of the viewport. Since this runs pre-hydration it can't
            read React state, so it asks matchMedia directly. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var el = document.getElementById('stage');
              if (!el) return;
              if (!window.matchMedia('${DESKTOP}').matches) return;
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
            onClick={wrapUp}
          >
            wrap &rarr;
          </button>

          {/* Inside Scene's overlay layer, so the card is positioned against
              the SCENE rather than the stage. That distinction only started
              mattering once the flower catalog stayed visible while wrapped:
              anchored to #stage, `bottom` would measure from the foot of the
              whole column and drop the card below the catalog. `.overlays`
              is inset:0 within #canvas, so right/bottom/% all resolve against
              the scene box.

              Safe on desktop, where the card is absolutely positioned
              regardless of depth and #canvas grows to fill the stage once the
              side panels collapse — so its containing block resolves to
              effectively the same rectangle either way. And safe against
              #canvas's `overflow: hidden`, because the card is explicitly
              sized to fit inside it (max-height + fluid preview). */}
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
      </div>
    </div>
  );
}
