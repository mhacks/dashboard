"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { FormatId, TicketState } from "@/lib/pass/types";
import { formatDef } from "@/lib/pass/formats";
import { ExportFrame } from "@/components/pass/export-frame";
import {
  BackdropChips,
  BouquetPicker,
  CityField,
  FontChips,
  FormatChips,
  NameField,
  Section,
  StickerPicker,
} from "@/components/pass/controls";
import { canShareFiles, downloadFrame, shareFrame } from "@/lib/pass/share";
import { prefersReducedMotion, usePanelEntrance } from "@/lib/pass/motion";
import { useFitScale } from "@/lib/pass/use-fit-scale";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMounted } from "@/hooks/use-mounted";

const DESKTOP = "(min-width: 1024px)";

/*
  The studio. The standalone app opened on a marketing splash that sold the
  idea and then handed over to this; behind the dashboard the visitor is
  signed in and arrived from their own tile, so the splash is gone and the
  studio is the whole route.

  `initial` is a starting point, not a constraint: it seeds the state once and
  every field remains editable through the same controls an empty pass gets.
*/
export function PassStudio({
  initial,
  firstName,
}: {
  initial: TicketState;
  /** Empty only if the application was submitted without one. */
  firstName: string;
}) {
  const [state, setState] = useState<TicketState>(initial);

  const patch = useCallback(
    (
      next:
        Partial<TicketState> | ((prev: TicketState) => Partial<TicketState>),
    ) => {
      setState((prev) => ({
        ...prev,
        ...(typeof next === "function" ? next(prev) : next),
      }));
    },
    [],
  );

  return (
    // minmax(0, …) rather than bare fr: the preview holds a fixed-size frame,
    // and without it that frame's min-content width widens the left column
    // past 55% and drags the split with it.
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      <Preview state={state} />
      <Controls state={state} firstName={firstName} onChange={patch} />
    </div>
  );
}

/* ——— left column: the pass on its stage, and the way out of here ——— */

function Preview({ state }: { state: TicketState }) {
  /*
    `shown` lags the chosen format so the pass can turn edge-on before it
    changes shape. The swap happens at the midpoint of the flip, where the card
    has no width to give the change away.
  */
  const [shown, setShown] = useState(state.format);
  // Mirrors `shown` for effect cleanup. The effect must not depend on `shown`
  // state — that re-ran the effect at the flip midpoint — and cleanup must not
  // call setState, which re-renders during unmount and blows up React while it
  // tears down the pass's inline SVG (correspondingUseElement in Firefox).
  const shownRef = useRef<FormatId>(state.format);
  const flipRef = useRef<HTMLDivElement>(null);
  // What the flip has already committed to. A ref, not the state, because the
  // effect must not re-run when the midpoint swap lands — depending on `shown`
  // meant this effect tore its own timeline down halfway through and left the
  // pass stranded edge-on at rotationY: -90.
  const settled = useRef(state.format);

  const revealFormat = (format: FormatId) => {
    shownRef.current = format;
    setShown(format);
  };

  useLayoutEffect(() => {
    const target = state.format;
    if (settled.current === target) return;

    const el = flipRef.current;
    if (!el || prefersReducedMotion()) {
      settled.current = target;
      revealFormat(target);
      return;
    }

    const tl = gsap.timeline();
    tl.set(el, { transformPerspective: 1600, transformOrigin: "center" })
      .to(el, { rotationY: -90, duration: 0.26, ease: "power2.in" })
      .add(() => {
        settled.current = target;
        revealFormat(target);
      })
      .to(el, { rotationY: 0, duration: 0.36, ease: "power2.out" });

    return () => {
      // Only reached if the format changes again mid-flip, or on unmount.
      // Square the pass back up so it can never be left on its edge.
      tl.kill();
      // Roll settled back to what is actually on screen so Strict Mode's
      // setup→cleanup→setup re-run sees settled !== target when the midpoint
      // never landed. Do not setState here — navigation away would re-render
      // into a tree React is already unmounting.
      settled.current = shownRef.current;
      if (el.isConnected) gsap.set(el, { rotationY: 0 });
    };
  }, [state.format]);

  const format = formatDef(shown);
  const isDesktop = useMediaQuery(DESKTOP);

  const { ref, scale: widthScale } = useFitScale(format.width, 1);
  // Portrait is 1920 tall — fitting on width alone would run it off the
  // screen, so cap by the height the column can actually give it.
  const maxHeight = isDesktop ? 620 : 290;
  const scale = Math.min(widthScale, maxHeight / format.height);

  const frameRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [note, setNote] = useState("");

  // Read after mount only: canShareFiles() touches navigator, and letting it
  // decide the button's label on the first client pass would make the
  // hydrated markup disagree with the server's.
  const mounted = useMounted();
  const canShare = mounted && canShareFiles();

  async function exportPass(via: "share" | "download") {
    if (printing || !frameRef.current) return;
    setPrinting(true);
    setNote("");
    try {
      if (via === "download") {
        await downloadFrame(frameRef.current, state.name, format);
        return;
      }
      // A share sheet that isn't there falls back to a download inside
      // shareFrame — worth saying so, since the button promised sharing.
      const outcome = await shareFrame(frameRef.current, state.name, format);
      if (outcome === "downloaded") setNote("Saved to your downloads.");
    } catch {
      setNote("Something didn’t print. Try once more.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <section
      className="mh-field sticky top-0 z-10 flex min-w-0 flex-col items-center justify-center border-b px-4 pt-6 pb-5 sm:px-6 lg:h-screen lg:border-b-0 lg:px-6 lg:py-8"
      style={{ borderBottomColor: "var(--ui-line)" }}
    >
      <div className="flex w-full max-w-[820px] flex-col items-center">
        {/* The way out. Above the stage rather than buried in the control
            panel, and first in the source order, so it is the first thing
            reached by keyboard and the first thing on screen once the columns
            stack on mobile. */}
        <div className="flex w-full" style={{ marginBottom: 14 }}>
          <Link href="/dashboard" className="mh-back">
            <span aria-hidden className="mh-glyph">
              {"←"}
            </span>
            Dashboard
          </Link>
        </div>

        {/* the box-drawing rule that brackets the pass on its stage */}
        <div
          aria-hidden
          className="flex w-full items-center"
          style={{ gap: 8, marginBottom: 12 }}
        >
          <span className="mh-glyph" style={{ fontSize: 12 }}>
            {"┌─"}
          </span>
          <span className="mh-eyebrow">preview</span>
          <span className="mh-rule" />
          <span className="mh-ramp" style={{ fontSize: 12 }}>
            {"░▒▓█"}
          </span>
        </div>

        <div ref={ref} className="flex w-full justify-center">
          {/* The flip owns its own node: GSAP writes the whole `transform`
              property, so sharing one with the fit-to-column scale would wipe
              it and the frame would render at full size. */}
          <div ref={flipRef}>
            <div
              style={{
                width: format.width * scale,
                height: format.height * scale,
              }}
            >
              <div
                style={{
                  width: format.width,
                  height: format.height,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  boxShadow: "0 10px 30px rgba(23, 23, 26, 0.16)",
                }}
              >
                <ExportFrame
                  state={{ ...state, format: shown }}
                  frameRef={frameRef}
                  interactive={!printing}
                />
              </div>
            </div>
          </div>
        </div>

        <p
          aria-hidden
          className="inline-flex items-center"
          style={{
            marginTop: 12,
            gap: 8,
            fontFamily: "var(--mh-ui-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--ui-ink-soft)",
          }}
        >
          <span className="mh-glyph">{"┤"}</span>
          {format.width} × {format.height} · {format.ratio}
          <span className="mh-glyph">{"├"}</span>
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => exportPass(canShare ? "share" : "download")}
            disabled={printing}
            style={{
              padding: "10px 16px",
              borderRadius: 2,
              background: "var(--ui-ink)",
              color: "var(--ui-paper)",
              border: "1px solid var(--ui-ink)",
              fontFamily: "var(--mh-ui-mono)",
              fontSize: 13,
              letterSpacing: "0.02em",
              cursor: printing ? "default" : "pointer",
              opacity: printing ? 0.72 : 1,
            }}
          >
            <span aria-hidden style={{ marginRight: 8, opacity: 0.85 }}>
              {">"}
            </span>
            {printing
              ? "printing…"
              : canShare
                ? "Share your pass"
                : "Download your pass"}
          </button>

          {/* Only where the primary shares — otherwise it would be the same
              action twice. */}
          {canShare && (
            <button
              type="button"
              onClick={() => exportPass("download")}
              disabled={printing}
              style={{
                padding: "10px 14px",
                borderRadius: 2,
                background: "transparent",
                color: "var(--ui-ink-soft)",
                border: "1px solid var(--ui-line)",
                fontFamily: "var(--mh-ui-mono)",
                fontSize: 13,
                letterSpacing: "0.02em",
                cursor: printing ? "default" : "pointer",
                opacity: printing ? 0.72 : 1,
              }}
            >
              Download instead
            </button>
          )}
        </div>

        <p
          role="status"
          aria-live="polite"
          style={{
            marginTop: 8,
            minHeight: 14,
            maxWidth: 420,
            textAlign: "center",
            fontFamily: "var(--mh-ui-mono)",
            fontSize: 10.5,
            letterSpacing: "0.04em",
            color: "var(--ui-ink-soft)",
          }}
        >
          {note}
        </p>
      </div>
    </section>
  );
}

/* ——— right column: every control visible at once, no accordions ——— */

function Controls({
  state,
  firstName,
  onChange,
}: {
  state: TicketState;
  firstName: string;
  onChange: (
    patch: Partial<TicketState> | ((prev: TicketState) => Partial<TicketState>),
  ) => void;
}) {
  // Every section flies in from the right edge the first time the designer
  // opens. Attached here rather than per-section so the stagger is one call.
  const panelRef = usePanelEntrance(true);

  return (
    <section
      className="px-5 py-9 sm:px-6 lg:h-screen lg:overflow-y-auto lg:px-10 lg:py-10"
      style={{ background: "var(--ui-surface)" }}
    >
      <div ref={panelRef} className="mx-auto max-w-[460px]">
        {/* the panel reads as a terminal window: a title bar of density ramp,
            then a prompt-led heading, then one console box per control group */}
        <div className="mh-box" data-panel-item>
          <div
            className="mh-box-bar"
            style={{ justifyContent: "space-between" }}
          >
            <span
              aria-hidden
              className="mh-ramp"
              style={{ fontSize: 12, flex: "1 1 auto" }}
            >
              {"░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░"}
            </span>
            <span
              aria-hidden
              className="mh-glyph"
              style={{ fontSize: 11, marginLeft: 10, letterSpacing: "0.12em" }}
            >
              {"[ mh-2026 ]"}
            </span>
          </div>

          <div style={{ padding: "18px 16px 20px" }}>
            <h1
              style={{
                fontFamily: "var(--mh-ui-mono)",
                fontWeight: 700,
                fontSize: 25,
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
                color: "var(--ui-ink)",
              }}
            >
              <span aria-hidden className="mh-caret" style={{ marginRight: 8 }}>
                {">"}
              </span>
              Welcome aboard{" "}
              {/* The last word and the cursor are one unbreakable unit — left
                  loose, the block would wrap onto a line of its own. Falls
                  back to the unaddressed original for the rare application
                  submitted without a first name. */}
              <span style={{ whiteSpace: "nowrap" }}>
                {firstName ? `${firstName}.` : "MHacks."}
                <span
                  aria-hidden
                  className="mh-cursor"
                  style={{ marginLeft: 2 }}
                >
                  {"▌"}
                </span>
              </span>
            </h1>
            <p
              style={{
                marginTop: 10,
                fontFamily: "var(--mh-ui-mono)",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "var(--ui-ink-soft)",
              }}
            >
              October 3–4, 2026 · Ann Arbor, Michigan
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <div data-panel-item>
            <Section label="format">
              <FormatChips value={state.format} onChange={onChange} />
            </Section>
          </div>
          <div data-panel-item>
            <Section label="backdrop">
              <BackdropChips value={state.backdrop} onChange={onChange} />
            </Section>
          </div>
          <div data-panel-item>
            <NameField value={state.name} onChange={onChange} />
          </div>
          <div data-panel-item>
            <CityField value={state.city} onChange={onChange} />
          </div>
          <div data-panel-item>
            <Section label="typeface">
              <FontChips value={state.font} onChange={onChange} />
            </Section>
          </div>
          <div data-panel-item>
            <Section label="bouquet">
              <BouquetPicker state={state} onChange={onChange} />
            </Section>
          </div>
          <div data-panel-item>
            <Section label="stickers">
              <StickerPicker state={state} onChange={onChange} />
            </Section>
          </div>
        </div>
      </div>
    </section>
  );
}
