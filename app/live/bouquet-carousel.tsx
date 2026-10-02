"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { toPlacedStems, type SharedBouquet } from "@/lib/bouquet/share";
import { renderSticker } from "@/lib/bouquet/sticker";
import "./bouquet-carousel.css";

/* Ported from the mhacks-live-site prototype's buildCarousel(). The strip is
   a flywheel: it drifts at rest, a mouse wheel spins it (scroll up → right),
   hovering eases it to a stop, and the sticker under the pointer shows who
   made it. Motion is driven from one rAF loop that writes styles directly, so
   none of it goes through React state. */

const TILTS = [-4, 3, -2, 5, -5, 2];
const LIFTS = ["-3%", "4%", "-1%", "3%", "-4%", "1%"];
const TAG_TILTS = [3, -4, 2, -3, 4, -2];

// Stickers per loop. Anything from 1 to 10 bouquets can come back, so the
// list repeats until a loop is comfortably wider than a wide screen.
const MIN_LOOP_ITEMS = 10;

// Export scale for the on-page stickers. ~0.8 keeps them crisp at the
// strip's height on a 2x display without the full download's cost.
const RENDER_SCALE = 0.8;

const DRIFT_SECONDS = 70; // one loop at rest
// Flywheel physics: the strip behaves like a heavy wheel with a clicker.
const INPUT_GAIN = 0.55; // speed (px/s) per unit of shaped wheel input
const INPUT_CURVE = 1.3; // >1: gentle scrolls count for little, firm ones for more
const INPUT_EASE = 0.18; // seconds for a push to transfer into the wheel (mass)
const DRAG = 1.4; // velocity-proportional resistance (1/s), the long ease-out
const FRICTION = 90; // constant resistance (px/s²), brings it to a gentle full stop
const MAX_BOOST = 2200;
const DETENT_PX = 34; // travel between clicks
const DETENT_LOSS = 0.012; // share of speed each click eats, like a ratchet catch

type Rendered = { id: string; makerName: string; src: string };

export function BouquetCarousel({
  bouquets,
}: {
  bouquets: readonly SharedBouquet[];
}) {
  const [rendered, setRendered] = useState<Rendered[] | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Canvas rendering needs `document`, so it happens after mount. All at
  // once, so the strip fades in whole instead of reflowing per sticker.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      bouquets.map(async (b) => {
        try {
          const a = b.arrangement;
          const cv = await renderSticker(
            toPlacedStems(a),
            a.order,
            a.vaseId,
            a.borderColor,
            RENDER_SCALE,
          );
          return {
            id: b.id,
            makerName: b.makerName,
            src: cv.toDataURL("image/png"),
          };
        } catch (error) {
          console.error("Failed to render bouquet", b.id, error);
          return null;
        }
      }),
    ).then((out) => {
      if (!cancelled) setRendered(out.filter((r) => r !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [bouquets]);

  // One loop's worth, then the loop twice over, so the track can wrap after
  // exactly one loop width without a visible seam.
  const loop = useMemo(() => {
    if (!rendered?.length) return [];
    const reps = Math.ceil(MIN_LOOP_ITEMS / rendered.length);
    return Array.from({ length: reps }, () => rendered).flat();
  }, [rendered]);

  useEffect(() => {
    const hero = heroRef.current;
    const track = trackRef.current;
    if (!hero || !track || !loop.length) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let loopW = 0;
    let x = 0; // drifting base position (px)
    let boost = 0; // flywheel velocity (px/s, + = rightwards)
    let pending = 0; // push not yet transferred into the flywheel (px/s)
    let detentTravel = 0; // distance since the last click
    let driftScale = reduceMotion ? 0 : 1;
    let hovering = false;
    let pointer: [number, number] | null = null;
    let active: Element | null = null;
    let lastSway = "";
    let raf = 0;

    // Loop length = distance from the first sticker to its repeat (the track
    // box doesn't size to its percentage-height children, so its width can't
    // be trusted).
    const items = track.children as HTMLCollectionOf<HTMLElement>;
    const measure = () => {
      loopW = items[loop.length].offsetLeft - items[0].offsetLeft;
    };
    measure();
    window.addEventListener("resize", measure);
    const imgs = Array.from(track.querySelectorAll("img"));
    for (const img of imgs) {
      if (!img.complete) img.addEventListener("load", measure);
    }

    // ---- tick sound (only once the page has an unlocked AudioContext) ----
    let audio: AudioContext | null = null;
    const unlockAudio = () => {
      try {
        audio ??= new AudioContext();
        if (audio.state === "suspended") void audio.resume();
      } catch {
        // no Web Audio: the wheel just spins silently
      }
    };
    const unlockEvents = ["pointerdown", "keydown", "touchstart"] as const;
    for (const t of unlockEvents) {
      window.addEventListener(t, unlockAudio, { passive: true });
    }
    let lastTick = 0;
    const tick = (speed: number) => {
      if (!audio || audio.state !== "running") return;
      const now = audio.currentTime;
      if (now - lastTick < 0.035) return; // a real wheel can't click faster than this
      lastTick = now;
      const len = Math.floor(audio.sampleRate * 0.012);
      const buf = audio.createBuffer(1, len, audio.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
      }
      const src = audio.createBufferSource();
      src.buffer = buf;
      const band = audio.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 2600 + Math.min(1, speed / MAX_BOOST) * 1400;
      band.Q.value = 6;
      const gain = audio.createGain();
      gain.gain.value = 0.35;
      src.connect(band).connect(gain).connect(audio.destination);
      src.start(now);
    };

    // ---- wheel → push on the flywheel. Scroll up spins right, down spins left. ----
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; // leave horizontal swipes alone
      e.preventDefault();
      const dy =
        e.deltaY *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? hero.clientHeight : 1);
      const push = -Math.sign(dy) * INPUT_GAIN * Math.abs(dy) ** INPUT_CURVE;
      if (reduceMotion)
        x += push * 0.12; // no momentum: just nudge
      else pending += push;
    };

    // ---- hover: ease the drift to a stop and show the maker tag ----
    const onPointerMove = (e: PointerEvent) => {
      pointer = [e.clientX, e.clientY];
    };
    const onPointerEnter = (e: PointerEvent) => {
      hovering = true;
      pointer = [e.clientX, e.clientY];
    };
    const onPointerLeave = () => {
      hovering = false;
      pointer = null;
    };
    hero.addEventListener("wheel", onWheel, { passive: false });
    hero.addEventListener("pointermove", onPointerMove);
    hero.addEventListener("pointerenter", onPointerEnter);
    hero.addEventListener("pointerleave", onPointerLeave);

    const setActive = (el: Element | null) => {
      if (el === active) return;
      active?.classList.remove("is-active");
      active = el;
      active?.classList.add("is-active");
    };

    let prev = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      // feed the pending push in over INPUT_EASE, so the wheel spins up instead of jumping
      if (pending) {
        const take = pending * Math.min(1, dt / INPUT_EASE);
        pending -= take;
        if (Math.abs(pending) < 0.5) pending = 0;
        boost = Math.max(-MAX_BOOST, Math.min(MAX_BOOST, boost + take));
      }
      // resistance: drag eases it out, friction settles it to a full stop
      const slowed = boost * Math.exp(-DRAG * dt);
      const stop = FRICTION * dt;
      boost = Math.abs(slowed) <= stop ? 0 : slowed - Math.sign(slowed) * stop;

      // clicker: tick every DETENT_PX of travel; each catch takes a little speed
      detentTravel += Math.abs(boost) * dt;
      if (detentTravel >= DETENT_PX) {
        detentTravel %= DETENT_PX;
        boost *= 1 - DETENT_LOSS;
        tick(Math.abs(boost));
      }
      if (!boost && !pending) detentTravel = 0;

      driftScale +=
        ((hovering || reduceMotion ? 0 : 1) - driftScale) * Math.min(1, dt * 4);
      const drift = loopW ? -(loopW / DRIFT_SECONDS) * driftScale : 0;
      x += (drift + boost) * dt;

      if (loopW) x = ((x % loopW) - loopW) % loopW;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      // stickers lean against the motion, like they have weight
      const sway = (
        reduceMotion ? 0 : Math.max(-7, Math.min(7, -boost / 140))
      ).toFixed(1);
      if (sway !== lastSway) {
        // only touch the variable when it changes; every write restyles every sticker
        lastSway = sway;
        track.style.setProperty("--sway", `${sway}deg`);
      }

      // hover is tracked here (not :hover) so it follows stickers that move under a still cursor
      const hit = pointer && document.elementFromPoint(pointer[0], pointer[1]);
      setActive(hit && hero.contains(hit) ? hit.closest(".sticker") : null);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      for (const img of imgs) img.removeEventListener("load", measure);
      for (const t of unlockEvents) {
        window.removeEventListener(t, unlockAudio);
      }
      hero.removeEventListener("wheel", onWheel);
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerenter", onPointerEnter);
      hero.removeEventListener("pointerleave", onPointerLeave);
      void audio?.close();
    };
  }, [loop]);

  return (
    <section
      ref={heroRef}
      className="sticker-hero"
      aria-label="Flower bouquets made by MHacks hackers"
    >
      <div
        ref={trackRef}
        className={`sticker-track${loop.length ? " is-ready" : ""}`}
      >
        {[...loop, ...loop].map((b, i) => {
          const k = i % TILTS.length;
          // only the first pass through the real bouquets is announced
          const decorative = i >= (rendered?.length ?? 0);
          return (
            <div
              key={i}
              className="sticker"
              style={
                {
                  "--tilt": `${TILTS[k]}deg`,
                  "--lift": LIFTS[k],
                  "--tag-tilt": `${TAG_TILTS[k]}deg`,
                } as React.CSSProperties
              }
              aria-hidden={decorative || undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a canvas data URL; next/image has nothing to optimise */}
              <img
                src={b.src}
                alt={
                  decorative
                    ? ""
                    : `MHacks wildflower bouquet sticker, made by ${b.makerName}`
                }
                draggable={false}
              />
              <span className="sticker-tag" aria-hidden="true">
                <span className="sticker-tag-label">Made by</span>
                <span className="sticker-tag-name">{b.makerName}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
