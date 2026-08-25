import type { Ref } from "react";
import type { TicketState } from "@/lib/pass/types";
import { fontDef } from "@/lib/pass/fonts";
import { ticketTheme } from "@/lib/pass/themes";
import {
  NOTCH_R,
  PERF_X,
  STUB_RATIO,
  TICKET_CLIP,
  TICKET_H,
  TICKET_W,
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

/** Steps down at 14 and 19 characters so a long name never overflows. */
function nameSize(length: number): number {
  if (length >= 19) return 33;
  if (length >= 14) return 40;
  return 48;
}

const NAME_MIN_SIZE = 22;
const CITY_MIN_SIZE = 12;

type Props = {
  state: TicketState;
  ticketRef?: Ref<HTMLDivElement>;
};

export function TicketLandscape({ state, ticketRef }: Props) {
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
  // The city is free text, so it gets the same fit treatment as the name.
  const cityEl = useTextFit(d.origin, 19, font.stack, CITY_MIN_SIZE);

  return (
    <div
      ref={ticketRef}
      role="img"
      aria-label={ticketAriaLabel(d)}
      className="relative overflow-hidden"
      style={{
        width: TICKET_W,
        height: TICKET_H,
        background: "var(--mh-paper)",
        clipPath: TICKET_CLIP,
        WebkitClipPath: TICKET_CLIP,
      }}
    >
      <PaperSheen
        sheenA={theme.vars["--mh-sheen-a"]}
        sheenB={theme.vars["--mh-sheen-b"]}
      />

      {/* Perforation — stops short of both notches so it reads as a tear line. */}
      <div
        aria-hidden
        className="absolute"
        style={{
          left: PERF_X - 1,
          top: NOTCH_R + 6,
          bottom: NOTCH_R + 6,
          width: 2,
          zIndex: 2,
          background:
            "repeating-linear-gradient(to bottom, var(--mh-sage-pale) 0 6px, transparent 6px 11px)",
        }}
      />

      <div className="relative flex h-full">
        {/* ——— main body ——— */}
        <div
          className="flex flex-col"
          style={{ width: PERF_X, padding: "22px 26px 16px" }}
        >
          <TicketHeader mark={d.mark} />

          <div
            aria-hidden
            style={{ marginTop: 14, height: 1, background: "var(--mh-border)" }}
          />

          <div style={{ marginTop: 14 }}>
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

          {/* One grid for both field rows, so FLIGHT and CLASS sit in true
              columns the way they do on a printed pass. */}
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "1fr 92px 116px",
              columnGap: 20,
              rowGap: 16,
              alignItems: "end",
            }}
          >
            {/* No arrow between the cities — the From/To labels already carry
                the direction, so a single even gap reads cleaner. */}
            <div className="flex items-end" style={{ gap: 28, minWidth: 0 }}>
              {/* Shrink but never grow — see the portrait layout's note.

                  Deliberately not clipped. useTextFit is already the guard —
                  flex squeezing this box is exactly what makes the loop fire —
                  and an `overflow: hidden` here shaved the last glyph off the
                  city in the exported PNG while the preview looked perfect.
                  A city that somehow bottoms out at CITY_MIN_SIZE now spills a
                  hair instead of losing a letter, which is the better failure. */}
              <div style={{ minWidth: 0, flex: "0 1 auto" }}>
                <div className="mh-field-label">From</div>
                <div
                  ref={cityEl}
                  style={{ ...codeStyle(font), opacity: d.hasCity ? 1 : 0.45 }}
                >
                  {d.origin}
                </div>
              </div>
              <div style={{ flex: "none" }}>
                <div className="mh-field-label">To</div>
                <div style={codeStyle(font)}>{DESTINATION}</div>
              </div>
            </div>
            <Field label="Flight" value={FLIGHT} size={15} />
            <Field label="Class" value={d.cls} size={15} />

            <Field label="Date" value={DATE} size={13} />
            <div />
            <div />
          </div>

          <div
            className="flex items-end"
            style={{ marginTop: "auto", minHeight: 62, gap: 14 }}
          >
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <StickerStrip stickers={d.stickers} direction="wrap" />
            </div>
            <BouquetSlot art={d.bouquetArt} upload={d.bouquetUpload} />
          </div>

          <div
            aria-hidden
            style={{ height: 1, background: "var(--mh-border)", marginTop: 10 }}
          />
          <div style={{ marginTop: 8 }}>
            <FooterLine />
          </div>
        </div>

        {/* ——— stub ——— */}
        <div
          className="relative flex flex-col"
          style={{
            width: TICKET_W * STUB_RATIO,
            padding: "22px 20px 16px",
          }}
        >
          <StubField label="Passenger" value={d.passenger} dim={d.isEmpty} />
          <div style={{ marginTop: 14 }}>
            <StubField label="From" value={d.origin} dim={!d.hasCity} />
          </div>
          <div style={{ marginTop: 14 }}>
            <StubField label="Flight" value={FLIGHT} />
          </div>

          <div style={{ marginTop: "auto" }}>
            <Barcode bars={d.bars} height={44} />
          </div>
          <div style={{ marginTop: 7 }}>
            <PassCode code={d.passCode} />
          </div>
        </div>
      </div>
    </div>
  );
}
