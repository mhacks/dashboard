import type { Ref } from "react";
import type { TicketState } from "@/lib/pass/types";
import { fontDef } from "@/lib/pass/fonts";
import { ticketTheme } from "@/lib/pass/themes";
import {
  NOTCH_R,
  PERF_Y,
  TICKET_CLIP_PORTRAIT,
  TICKET_P_H,
  TICKET_P_W,
} from "@/lib/pass/geometry";
import {
  Barcode,
  BouquetSlot,
  DATE,
  DESTINATION,
  FLIGHT,
  Field,
  FooterLine,
  PaperSheen,
  PassCode,
  StickerStrip,
  StubField,
  SUBPIXEL_SLACK,
  TicketHeader,
  codeStyle,
  ticketAriaLabel,
  useTextFit,
  useTicketData,
} from "@/components/pass/ticket-parts";

/*
  The portrait pass is a re-layout, not a rotation — every word still reads
  left-to-right. What changes is the flow: the fields stack down the pass
  instead of running across it, the sticker strip becomes a column, and the
  tear-off sits along the bottom edge with the barcode running its full width.
*/

/** Same idea as landscape, scaled for a 316px-wide name slot. */
function nameSize(length: number): number {
  if (length >= 19) return 25;
  if (length >= 14) return 30;
  return 36;
}

const NAME_MIN_SIZE = 15;
const CITY_MIN_SIZE = 11;

/** Height of the tear-off along the bottom. */
const STUB_H = TICKET_P_H - PERF_Y; // 252

type Props = {
  state: TicketState;
  ticketRef?: Ref<HTMLDivElement>;
};

export function TicketPortrait({ state, ticketRef }: Props) {
  const font = fontDef(state.font);
  const d = useTicketData(state);
  const theme = ticketTheme(state.backdrop);

  const baseNameSize = nameSize(d.passenger.length) * font.nameScale;
  const nameEl = useTextFit(
    d.passenger,
    baseNameSize,
    font.stack,
    NAME_MIN_SIZE,
  );
  const cityEl = useTextFit(d.origin, 19, font.stack, CITY_MIN_SIZE);

  return (
    <div
      ref={ticketRef}
      role="img"
      aria-label={ticketAriaLabel(d)}
      className="relative overflow-hidden"
      style={{
        width: TICKET_P_W,
        height: TICKET_P_H,
        background: "var(--mh-paper)",
        clipPath: TICKET_CLIP_PORTRAIT,
        WebkitClipPath: TICKET_CLIP_PORTRAIT,
      }}
    >
      <PaperSheen
        sheenA={theme.vars["--mh-sheen-a"]}
        sheenB={theme.vars["--mh-sheen-b"]}
      />

      {/* Perforation — now horizontal, stopping short of the side notches. */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: PERF_Y - 1,
          left: NOTCH_R + 6,
          right: NOTCH_R + 6,
          height: 2,
          zIndex: 2,
          background:
            "repeating-linear-gradient(to right, var(--mh-sage-pale) 0 6px, transparent 6px 11px)",
        }}
      />

      <div className="relative flex h-full flex-col">
        {/* ——— main body ——— */}
        <div
          className="flex flex-col"
          style={{ height: PERF_Y, padding: "18px 22px 14px" }}
        >
          <TicketHeader mark={d.mark} wordmarkSize={18} labelSize={7.5} />

          <div
            aria-hidden
            style={{ marginTop: 10, height: 1, background: "var(--mh-border)" }}
          />

          <div style={{ marginTop: 12 }}>
            <div className="mh-field-label">Passenger</div>
            <div
              ref={nameEl}
              style={{
                marginTop: 8,
                fontFamily: font.stack,
                fontWeight: font.nameWeight,
                fontSize: baseNameSize,
                letterSpacing: `${font.nameTracking}em`,
                lineHeight: 1,
                color: "var(--mh-moss-deep)",
                opacity: d.isEmpty ? 0.32 : 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                paddingRight: SUBPIXEL_SLACK,
              }}
            >
              {d.passenger}
            </div>
          </div>

          {/*
            Auto margins rather than fixed gaps, so the remaining slack spreads
            evenly instead of pooling in one place. There is far less slack to
            spread now that the pass is 620 tall rather than 900 — the fields
            sit at a printed-ticket rhythm instead of drifting apart.
          */}

          {/* FROM / TO keeps its own row; it's the one pairing that has to read
              as a journey rather than as two unrelated fields. No arrow — the
              labels carry the direction and one even gap reads cleaner. */}
          <div
            className="flex items-end"
            style={{ marginTop: "auto", paddingTop: 14, gap: 22 }}
          >
            {/* Shrink but never grow: growing would shove TO against the far
                edge and break the pairing the removed arrow used to carry. */}
            {/* Deliberately not clipped — see the landscape layout's note:
                useTextFit is the guard, and clipping here shaved the last
                glyph off the city in the export. */}
            <div style={{ minWidth: 0, flex: "0 1 auto" }}>
              <div className="mh-field-label">From</div>
              <div
                ref={cityEl}
                style={{
                  ...codeStyle(font, 19),
                  opacity: d.hasCity ? 1 : 0.45,
                }}
              >
                {d.origin}
              </div>
            </div>
            <div style={{ flex: "none" }}>
              <div className="mh-field-label">To</div>
              <div style={codeStyle(font, 19)}>{DESTINATION}</div>
            </div>
          </div>

          {/* Three fields across, not two down — the shorter pass has width to
              spare and no height to waste. */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: 14,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 16,
              rowGap: 14,
              alignItems: "end",
            }}
          >
            <Field label="Flight" value={FLIGHT} size={15} />
            <Field label="Class" value={d.cls} size={15} />
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Date" value={DATE} size={14} />
            </div>
          </div>

          {/* Stickers wrap beside the bouquet slot rather than stacking into a
              column — a column ate most of the height the pass just gave up. */}
          <div
            className="flex items-end"
            style={{ marginTop: "auto", paddingTop: 14, gap: 12 }}
          >
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <StickerStrip stickers={d.stickers} direction="wrap" />
            </div>
            <BouquetSlot
              art={d.bouquetArt}
              upload={d.bouquetUpload}
              size={58}
            />
          </div>

          <div
            aria-hidden
            style={{ height: 1, background: "var(--mh-border)", marginTop: 12 }}
          />
          <div style={{ marginTop: 7 }}>
            <FooterLine size={11} />
          </div>
        </div>

        {/* ——— stub ——— */}
        <div
          className="relative flex flex-col"
          style={{ height: STUB_H, padding: "14px 22px 12px" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              columnGap: 16,
            }}
          >
            <StubField label="Passenger" value={d.passenger} dim={d.isEmpty} />
            <StubField label="From" value={d.origin} dim={!d.hasCity} />
          </div>

          <div style={{ marginTop: "auto" }}>
            <Barcode bars={d.bars} height={34} />
          </div>
          <div style={{ marginTop: 6 }}>
            <PassCode code={d.passCode} />
          </div>
        </div>
      </div>
    </div>
  );
}
