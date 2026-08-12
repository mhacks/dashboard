import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useCrossfade } from "@/lib/pass/motion";
import type { TicketState } from "@/lib/pass/types";
import type { FontDef } from "@/lib/pass/fonts";
import { fareClass } from "@/lib/pass/classes";
import { placedStickers } from "@/components/pass/stickers";
import type { PlacedSticker } from "@/components/pass/stickers";
import { bouquetDef } from "@/components/pass/bouquets";
import { ticketTheme } from "@/lib/pass/themes";
import { barcodeFor, passCodeFor } from "@/lib/pass/hash";

/*
  Everything both orientations share. The landscape and portrait passes are two
  different layouts of the same document, not one rotated — so the field
  grammar, the hashing, the type scale and the sticker treatment all live here
  and neither layout can drift from the other.
*/

/* Fixed copy — the destination and the flight are the same for everybody. */
export const DESTINATION = "ANN ARBOR";
export const FLIGHT = "MH-26";
export const DATE = "03–04 OCT 2026"; // en dash, matching the site's date style
export const FOOTER = "Build something that grows.";
export const PLACEHOLDER = "YOUR NAME HERE";

/** Where the pass departs from before anyone says otherwise. */
export const ORIGIN_FALLBACK = "ANYWHERE";

// Re-exported from their own module so the server-side prefill can read them
// without importing this one, which is all hooks and JSX.
export { CITY_MAX, NAME_MAX } from "@/lib/pass/limits";

/** Everything derived from the state that both layouts need. */
export function useTicketData(state: TicketState) {
  const typed = state.name.trim().toUpperCase();
  const isEmpty = typed.length === 0;

  const city = state.city.trim().toUpperCase();

  // One resolution point for both derived marks: the applicant id when the
  // studio was opened from the dashboard, the typed name otherwise. `?? name`
  // means a seedless state renders byte-identically to the standalone app.
  const seed = state.seed ?? state.name;

  return {
    typed,
    isEmpty,
    passenger: isEmpty ? PLACEHOLDER : typed,
    origin: city || ORIGIN_FALLBACK,
    hasCity: city.length > 0,
    cls: fareClass(state.experience),
    passCode: passCodeFor(seed),
    // Lives here rather than in each layout so the two can never disagree —
    // they were calling barcodeFor() separately, which is exactly the drift
    // this module exists to prevent.
    bars: barcodeFor(seed),
    stickers: placedStickers(state),
    bouquetArt: bouquetDef(state.bouquet)?.art ?? null,
    bouquetUpload: state.bouquet === "upload" ? state.bouquetUpload : null,
    mark: ticketTheme(state.backdrop).mark,
  };
}

export function ticketAriaLabel(d: ReturnType<typeof useTicketData>): string {
  return [
    `MHacks 2026 boarding pass.`,
    d.isEmpty ? "No passenger name yet." : `Passenger ${d.typed}.`,
    `From ${d.origin} to ${DESTINATION}.`,
    `Flight ${FLIGHT}. Class ${d.cls}. ${DATE}.`,
    d.stickers.length
      ? `Stickers: ${d.stickers.map((s) => s.label).join(", ")}.`
      : "No stickers yet.",
  ].join(" ");
}

/**
 * Fits a line of type to its slot.
 *
 * The character-count steps carry every ordinary value; this shrinks the
 * pathological ones the rest of the way. Runs before paint, so there is no
 * visible resize.
 */
export function useTextFit(
  text: string,
  baseSize: number,
  fontKey: string,
  minSize: number,
) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    /*
      scrollWidth/clientWidth on purpose, and no safety margin: these boxes are
      shrink-to-fit until flex actually squeezes them, so when the text fits
      the box *is* the text and any headroom here would shrink the box in step
      with the type, all the way down to minSize.

      The slack that keeps the export from shaving the last glyph therefore
      lives on the clipping box instead — see SUBPIXEL_SLACK.
    */
    el.style.fontSize = `${baseSize}px`;
    let size = baseSize;
    while (el.scrollWidth > el.clientWidth && size > minSize) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }, [text, baseSize, fontKey, minSize]);

  return ref;
}

/* ——— paper ——— */

/**
 * The sheen on the stock.
 *
 * Two layers, both static and both export-safe: a soft diagonal sweep that
 * reads as light catching a laminated card, and a fine speckle of pale flecks
 * that reads as glitter in the paper. Deliberately built from a gradient and a
 * tiling data URI rather than a blend mode — blend modes do not always survive
 * html-to-image's foreignObject pass, and this has to look the same in the PNG.
 */
function glitterTile(a: string, b: string): string {
  return encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90">
       <g fill="#ffffff">
         <circle cx="11" cy="17" r="1.1"/><circle cx="63" cy="9" r="0.8"/>
         <circle cx="35" cy="41" r="1"/><circle cx="80" cy="52" r="1.2"/>
         <circle cx="52" cy="70" r="0.9"/><circle cx="21" cy="63" r="1.1"/>
         <circle cx="72" cy="31" r="0.7"/><circle cx="6" cy="83" r="0.9"/>
         <circle cx="44" cy="14" r="0.7"/><circle cx="88" cy="77" r="0.8"/>
       </g>
       <g fill="${a}">
         <circle cx="27" cy="30" r="0.9"/><circle cx="58" cy="47" r="1"/>
         <circle cx="15" cy="49" r="0.7"/><circle cx="69" cy="84" r="0.9"/>
         <circle cx="41" cy="88" r="0.7"/><circle cx="84" cy="21" r="0.8"/>
       </g>
       <g fill="${b}">
         <circle cx="48" cy="26" r="0.8"/><circle cx="19" cy="76" r="0.7"/>
         <circle cx="76" cy="64" r="0.9"/><circle cx="33" cy="57" r="0.7"/>
       </g>
     </svg>`.replace(/\s+/g, " "),
  );
}

/**
 * The flecks take the theme's two accent tints. A data URI cannot resolve
 * var(), so these come in as literals — resolved from the theme rather than
 * hardcoded, which is why the pink-and-blue glitter doesn't follow a green
 * pass onto the grove.
 */
export function PaperSheen({
  sheenA = "#bcd0ff",
  sheenB = "#dfe4ff",
}: {
  sheenA?: string;
  sheenB?: string;
}) {
  return (
    <>
      {/* Wide, low-contrast ramp: a narrow one reads as a seam across the
          stock rather than as light moving over it. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(112deg, rgba(255,255,255,0) 6%, rgba(255,255,255,0.5) 30%, ${sheenA} 45%, ${sheenB} 60%, rgba(255,255,255,0) 92%)`,
          opacity: 0.26,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,${glitterTile(sheenA, sheenB)}")`,
          backgroundSize: "90px 90px",
          backgroundRepeat: "repeat",
          opacity: 0.62,
        }}
      />
    </>
  );
}

/* ——— shared field type ——— */

/**
 * Trailing slack on anything that clips its text.
 *
 * The export rasterizes the ticket through a scaled <foreignObject>, where the
 * last glyph's right side-bearing lands a fraction past a box sized exactly to
 * its text and gets shaved — FROM read "MICHIGA" and TO read "ANN ARBOF" in
 * the PNG while the preview looked perfect.
 *
 * It goes on whichever element carries `overflow: hidden`, which pushes that
 * element's clip edge clear of its text. Putting it on the text itself does
 * nothing when the text box is shrink-to-fit: the padding grows the box by the
 * same amount and the content edge lands where it started.
 *
 * Four rather than one: the exporter freezes each ancestor's width rounded to
 * whole pixels, so a couple of nested boxes can eat a pixel each before the
 * ticket's own up-scale (up to 2.4x) magnifies what is left. Two was still
 * shaving a sliver off the N in MICHIGAN.
 */
export const SUBPIXEL_SLACK = 4;

/**
 * The FROM/TO slots — one of only two places that takes the chosen face.
 *
 * Deliberately **not** `overflow: hidden`. These boxes are shrink-to-fit, so
 * their width is exactly their text's width — zero slack — and the export
 * rasterizes the ticket through a scaled <foreignObject>, where the last
 * glyph's right side-bearing falls a fraction outside that box and gets
 * shaved. FROM read "MICHIGA" and TO read "ANN ARBOF" in the PNG while the
 * preview looked perfect, which is what makes this worth spelling out.
 *
 * SUBPIXEL_SLACK cannot fix it here: on an auto-width box the padding grows
 * the box too. The clip belongs on the wrapper flex actually squeezes — see
 * FROM in ticket-landscape.tsx and ticket-portrait.tsx, where the value fills
 * that wrapper so useTextFit has a real box to shrink into.
 */
export function codeStyle(font: FontDef, size = 19): CSSProperties {
  return {
    marginTop: 7,
    fontFamily: font.stack,
    fontWeight: font.codeWeight,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: "0.01em",
    color: "var(--mh-moss-deep)",
    whiteSpace: "nowrap",
  };
}

export function Field({
  label,
  value,
  size,
}: {
  label: string;
  value: string;
  size: number;
}) {
  return (
    <div>
      <div className="mh-field-label">{label}</div>
      <div
        className="mh-field-value"
        style={{ marginTop: 7, fontSize: size, whiteSpace: "nowrap" }}
      >
        {value}
      </div>
    </div>
  );
}

export function StubField({
  label,
  value,
  dim = false,
  labelSize = 7.5,
  valueSize = 11,
}: {
  label: string;
  value: string;
  dim?: boolean;
  labelSize?: number;
  valueSize?: number;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="mh-field-label" style={{ fontSize: labelSize }}>
        {label}
      </div>
      <div
        className="mh-field-value"
        style={{
          marginTop: 6,
          fontSize: valueSize,
          opacity: dim ? 0.32 : 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          // Without the slack a sub-pixel rounding in the export turns a value
          // that fits into one showing an ellipsis. See SUBPIXEL_SLACK.
          paddingRight: SUBPIXEL_SLACK,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ——— header, stickers, barcode, footer ——— */

const MARK_LAYER: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

export function TicketHeader({
  mark,
  wordmarkSize = 21,
  labelSize = 9,
  crossfade = true,
}: {
  /** The M pre-rendered in this theme's ink. */
  mark: string;
  wordmarkSize?: number;
  labelSize?: number;
  crossfade?: boolean;
}) {
  const { under: markUnder, topRef: markRef } = useCrossfade<HTMLImageElement>(
    mark,
    0.6,
    crossfade,
  );

  return (
    <div className="flex items-center gap-2.5">
      {/* The petal M from the MHacks site, repainted in the pass's ink. A PNG
          rather than a trace: the petals have soft alpha edges that an outline
          would lose, so each theme gets its own pre-rendered copy — and the
          copies cross-fade, so the mark doesn't cut while everything else on
          the pass is dissolving. */}
      <span
        aria-hidden
        style={{
          position: "relative",
          height: wordmarkSize * 1.18,
          width: wordmarkSize * 1.25,
          flex: "none",
          display: "block",
        }}
      >
        {/* eslint-disable @next/next/no-img-element -- next/image renders a
            <picture> with a srcset of /_next/image URLs; html-to-image needs a
            plain same-origin src it can fetch and inline into the PNG. */}
        {markUnder ? <img src={markUnder} alt="" style={MARK_LAYER} /> : null}
        <img ref={markRef} src={mark} alt="" style={MARK_LAYER} />
        {/* eslint-enable @next/next/no-img-element */}
      </span>
      <span
        style={{
          fontFamily: "var(--mh-ui)",
          fontWeight: 800,
          fontSize: wordmarkSize,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--mh-moss)",
        }}
      >
        MHACKS
      </span>
      <span
        aria-hidden
        style={{
          width: 1,
          height: 12,
          background: "var(--mh-border-strong)",
          transform: "translateY(-1px)",
        }}
      />
      <span className="mh-field-label" style={{ fontSize: labelSize }}>
        Boarding Pass
      </span>
    </div>
  );
}

export function StickerStrip({
  stickers,
  direction = "row",
}: {
  stickers: PlacedSticker[];
  /** `wrap` is the portrait mode: a row that folds rather than a hard column. */
  direction?: "row" | "column" | "wrap";
}) {
  const column = direction === "column";
  return (
    <div
      aria-hidden
      className="flex"
      style={{
        flexDirection: column ? "column" : "row",
        flexWrap: direction === "wrap" ? "wrap" : "nowrap",
        alignItems: column ? "flex-start" : "center",
        alignContent: "flex-start",
        gap: column ? 8 : 7,
      }}
    >
      {/* One hue for every sticker, taken from the pass's theme — three
          unrelated pastels read as three stickers from three different passes. */}
      {stickers.map((sticker) => {
        return (
          <span
            key={sticker.key}
            className="inline-flex items-center"
            style={{
              gap: 6,
              padding: "6px 11px",
              borderRadius: 999,
              background: "var(--mh-sticker-tint)",
              border: "1px solid var(--mh-sticker-ink)",
              color: "var(--mh-sticker-ink)",
            }}
          >
            {sticker.icon}
            <span
              style={{
                fontFamily: "var(--mh-ui-mono)",
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                lineHeight: 1,
                color: "var(--mh-moss-deep)",
                whiteSpace: "nowrap",
              }}
            >
              {sticker.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Bar widths are hashed from the name, so the barcode never flickers. */
export function Barcode({ bars, height }: { bars: number[]; height: number }) {
  return (
    <div
      aria-hidden
      className="flex items-end justify-center"
      style={{ height, gap: 2 }}
    >
      {bars.map((w, i) => (
        <span
          key={i}
          style={{
            width: w,
            height: "100%",
            background: "var(--mh-moss-deep)",
            flex: "none",
          }}
        />
      ))}
    </div>
  );
}

export function PassCode({ code }: { code: string }) {
  return (
    <div
      aria-hidden
      className="text-center"
      style={{
        fontFamily: "var(--mh-ui-mono)",
        fontSize: 9,
        letterSpacing: "0.28em",
        color: "var(--mh-sage)",
      }}
    >
      {code}
    </div>
  );
}

/**
 * The bouquet slot.
 *
 * Empty, it is a dashed square waiting for something — the same affordance a
 * physical pass gives you when it leaves a box for a stamp. Filled, the
 * bouquet sits on top of the dashes and the frame recedes.
 *
 * An uploaded bouquet comes in as a data URL from the mini-game's PNG, which
 * is already inline, so it needs nothing special to survive the export.
 */
export function BouquetSlot({
  art,
  upload,
  size = 62,
}: {
  art?: ReactNode;
  upload?: string | null;
  size?: number;
}) {
  const filled = Boolean(art || upload);

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        flex: "none",
        position: "relative",
        borderRadius: 6,
        border: `1px dashed ${filled ? "transparent" : "var(--mh-sage-pale)"}`,
        color: "var(--mh-moss)",
      }}
    >
      {upload ? (
        // A data URL from the hacker's own file picker — nothing for
        // next/image to optimize, and html-to-image needs the raw src.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={upload}
          alt=""
          style={{
            position: "absolute",
            inset: 2,
            width: "calc(100% - 4px)",
            height: "calc(100% - 4px)",
            objectFit: "contain",
          }}
        />
      ) : art ? (
        <div style={{ position: "absolute", inset: 5 }}>{art}</div>
      ) : (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--mh-ui-mono)",
            fontSize: 6.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--mh-sage-pale)",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          bouquet
        </span>
      )}
    </div>
  );
}

export function FooterLine({ size = 13 }: { size?: number }) {
  return (
    <div
      style={{
        fontFamily: "var(--mh-ui-serif)",
        fontStyle: "italic",
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.01em",
        color: "var(--mh-sage)",
      }}
    >
      {FOOTER}
    </div>
  );
}
