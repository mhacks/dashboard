import Image from "next/image";
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { TicketState } from "@/lib/pass/types";
import { FONTS } from "@/lib/pass/fonts";
import { FORMATS } from "@/lib/pass/formats";
import { BACKDROPS } from "@/lib/pass/backdrops";
import {
  BOUQUETS,
  BOUQUET_FINE_PRINT_LINK,
  BOUQUET_FINE_PRINT_PREFIX,
  BOUQUET_GAME_URL,
} from "@/components/pass/bouquets";
import {
  BOUQUET_HANDOFF_STORAGE_KEY,
  clearBouquetHandoff,
  readBouquetHandoff,
} from "@/lib/pass/handoff";
import {
  EXPERIENCES,
  STUDIES,
  STUDY_MAX,
  YEARS,
  type StickerDef,
} from "@/components/pass/stickers";
import type { StudyId } from "@/lib/pass/types";
import { ticketTheme } from "@/lib/pass/themes";
import { CITY_MAX, NAME_MAX } from "@/components/pass/ticket-parts";

type Patch = (patch: Partial<TicketState>) => void;

/* ——— console primitives ——— */

/** Selection marker: [x] picked, [ ] not. */
function Mark({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="mh-mark" style={{ fontSize: 11 }}>
      {on ? "[x]" : "[ ]"}
    </span>
  );
}

/** A bordered region with a header bar carved into its top edge. */
export function ConsoleBox({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="mh-box">
      <div className="mh-box-bar">
        <span aria-hidden className="mh-caret" style={{ fontSize: 12 }}>
          {">"}
        </span>
        {htmlFor ? (
          <label htmlFor={htmlFor} className="mh-eyebrow">
            {label}
          </label>
        ) : (
          <h2 className="mh-eyebrow">{label}</h2>
        )}
        <span aria-hidden className="mh-rule" />
        <span aria-hidden className="mh-ramp" style={{ fontSize: 11 }}>
          {"░▒▓█"}
        </span>
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 2,
  padding: "10px 12px",
  background: "var(--ui-well)",
  border: "1px solid var(--ui-line)",
  color: "var(--ui-ink)",
  fontFamily: "var(--mh-ui-mono)",
  fontSize: 14,
  letterSpacing: 0,
};

const helpStyle: CSSProperties = {
  marginTop: 8,
  fontFamily: "var(--mh-ui-mono)",
  fontSize: 10.5,
  letterSpacing: "0.04em",
  color: "var(--ui-ink-soft)",
};

function cellStyle(selected: boolean): CSSProperties {
  return {
    borderRadius: 2,
    padding: "8px 12px",
    background: selected ? "var(--ui-selected-fill)" : "var(--ui-paper)",
    border: selected ? "1px solid var(--ui-ink)" : "1px solid var(--ui-line)",
    color: "var(--ui-ink)",
    cursor: "pointer",
    transition:
      "background 140ms var(--mh-ease), border-color 140ms var(--mh-ease)",
  };
}

/* ——— name and city ——— */

export function NameField({
  value,
  onChange,
}: {
  value: string;
  onChange: Patch;
}) {
  return (
    <ConsoleBox label="name" htmlFor="passenger-name">
      <input
        id="passenger-name"
        type="text"
        value={value}
        maxLength={NAME_MAX}
        autoComplete="name"
        spellCheck={false}
        // maxLength stops typing and pasting, but slice() is the guarantee —
        // the ticket's type only steps down as far as 19+ characters.
        onChange={(e) => onChange({ name: e.target.value.slice(0, NAME_MAX) })}
        style={inputStyle}
      />
      <p style={helpStyle}>22 characters</p>
    </ConsoleBox>
  );
}

export function CityField({
  value,
  onChange,
}: {
  value: string;
  onChange: Patch;
}) {
  return (
    <ConsoleBox label="leaving from" htmlFor="departure-city">
      <input
        id="departure-city"
        type="text"
        value={value}
        maxLength={CITY_MAX}
        autoComplete="address-level2"
        spellCheck={false}
        placeholder="What city are you leaving from?"
        onChange={(e) => onChange({ city: e.target.value.slice(0, CITY_MAX) })}
        style={inputStyle}
      />
    </ConsoleBox>
  );
}

/* ——— format ——— */

export function FormatChips({
  value,
  onChange,
}: {
  value: TicketState["format"];
  onChange: Patch;
}) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}
    >
      {FORMATS.map((format) => {
        const selected = format.id === value;
        return (
          <button
            key={format.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange({ format: format.id })}
            style={{
              ...cellStyle(selected),
              padding: "10px 8px 9px",
              textAlign: "center",
            }}
          >
            {/* A miniature of the frame's real proportions, sized off a fixed
                height so the portrait chip keeps its tall shape. */}
            <span
              aria-hidden
              className="flex items-center justify-center"
              style={{ height: 32, marginBottom: 8 }}
            >
              <span
                style={{
                  height: 32,
                  width: 32 * (format.width / format.height),
                  border: "1px solid var(--ui-line-strong)",
                  borderRadius: 1,
                }}
              />
            </span>
            <span
              className="inline-flex items-center"
              style={{
                gap: 6,
                fontFamily: "var(--mh-ui-mono)",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ui-ink)",
              }}
            >
              <Mark on={selected} />
              {format.label}
            </span>
            <span
              style={{
                display: "block",
                marginTop: 4,
                fontFamily: "var(--mh-ui-mono)",
                fontSize: 9.5,
                letterSpacing: "0.06em",
                color: "var(--ui-ink-soft)",
              }}
            >
              {format.ratio}
            </span>
            <span
              style={{
                display: "block",
                marginTop: 3,
                fontFamily: "var(--mh-ui-mono)",
                fontSize: 8.5,
                letterSpacing: "0.04em",
                lineHeight: 1.3,
                color: "var(--ui-ink-soft)",
              }}
            >
              {format.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ——— backdrop ——— */

export function BackdropChips({
  value,
  onChange,
}: {
  value: TicketState["backdrop"];
  onChange: Patch;
}) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}
    >
      {BACKDROPS.map((backdrop) => {
        const selected = backdrop.id === value;
        return (
          <button
            key={backdrop.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange({ backdrop: backdrop.id })}
            style={{ ...cellStyle(selected), padding: 0, overflow: "hidden" }}
          >
            {/*
              The actual image, so the choice is made on the thing itself.

              next/image here and nowhere else in the studio: this subtree is
              never rasterized, so it is free to take an optimized srcset —
              and it has to, because painting all five full-resolution
              backdrops meant pulling ~2MB the moment the studio opened. The
              export frame still uses the raw /public URL, which is the one
              html-to-image can inline.
            */}
            <Image
              aria-hidden
              src={backdrop.src}
              alt=""
              width={120}
              height={62}
              quality={40}
              priority={selected}
              className="block h-[62px] w-full object-cover"
            />
            <span
              style={{
                display: "block",
                padding: "7px 8px 8px",
                borderTop: "1px solid var(--ui-line)",
              }}
            >
              <span
                className="inline-flex items-center"
                style={{
                  gap: 6,
                  fontFamily: "var(--mh-ui-mono)",
                  fontSize: 11.5,
                  color: "var(--ui-ink)",
                }}
              >
                <Mark on={selected} />
                {backdrop.label}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 3,
                  fontFamily: "var(--mh-ui-mono)",
                  fontSize: 8.5,
                  letterSpacing: "0.04em",
                  color: "var(--ui-ink-soft)",
                }}
              >
                {backdrop.note}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ——— typeface ——— */

export function FontChips({
  value,
  onChange,
}: {
  value: TicketState["font"];
  onChange: Patch;
}) {
  return (
    <div className="flex flex-wrap" style={{ gap: 8 }}>
      {FONTS.map((font) => {
        const selected = font.id === value;
        return (
          <button
            key={font.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange({ font: font.id })}
            className="inline-flex items-center"
            style={{ ...cellStyle(selected), gap: 7 }}
          >
            <Mark on={selected} />
            {/* Each chip sets its own name in its own face. */}
            <span
              style={{
                fontFamily: font.stack,
                fontSize: 15,
                fontWeight: font.id === "serif" ? 400 : 500,
              }}
            >
              {font.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ——— bouquet ——— */

export function BouquetPicker({
  state,
  onChange,
}: {
  state: TicketState;
  onChange: Patch;
}) {
  useEffect(() => {
    function apply(dataUrl: string) {
      onChange({ bouquet: "upload", bouquetUpload: dataUrl });
      clearBouquetHandoff();
    }

    // Same-tab return from the bouquet game, or reopening the pass later —
    // pick up whatever is waiting the moment this control mounts.
    const pending = readBouquetHandoff();
    if (pending) apply(pending);

    // The bouquet game opens in its own tab so this tab's in-progress pass
    // survives (see the link below); `storage` fires here the instant that
    // other tab sends its bouquet over, so the tile updates live without
    // switching back first.
    function onStorage(event: StorageEvent) {
      if (event.key === BOUQUET_HANDOFF_STORAGE_KEY && event.newValue) {
        apply(event.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [onChange]);

  return (
    <div>
      <p
        style={{
          fontFamily: "var(--mh-ui-mono)",
          fontSize: 11,
          letterSpacing: "0.04em",
          color: "var(--ui-ink-soft)",
          marginBottom: 10,
        }}
      >
        Choose a sticker
      </p>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}
      >
        {BOUQUETS.map((bouquet) => {
          const selected = state.bouquet === bouquet.id;
          return (
            <button
              key={bouquet.id}
              type="button"
              aria-pressed={selected}
              // Picking the selected one again clears the slot.
              onClick={() =>
                onChange({ bouquet: selected ? "none" : bouquet.id })
              }
              style={{ ...cellStyle(selected), padding: "10px 6px 8px" }}
            >
              <span
                aria-hidden
                className="mx-auto block"
                style={{ width: 34, height: 34, color: "var(--ui-ink)" }}
              >
                {bouquet.art}
              </span>
              <span
                className="inline-flex items-center"
                style={{
                  gap: 5,
                  marginTop: 7,
                  fontFamily: "var(--mh-ui-mono)",
                  fontSize: 10,
                  color: "var(--ui-ink)",
                }}
              >
                <Mark on={selected} />
                {bouquet.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={state.bouquet === "upload"}
          // A same-tab navigation here would throw away every other field on
          // the pass, since none of it is persisted — see the note on
          // ExportPanel's "MHacks ticket" link for why the bouquet game opens
          // in its own tab instead, and the effect above for how its result
          // finds its way back.
          //
          // No "noopener"/"noreferrer": both sever `window.opener`, and
          // ExportPanel's "switch back to that tab" needs it to focus this
          // exact tab rather than opening yet another one. Safe to skip here
          // specifically because the opened page is our own /dashboard/bouquet
          // route, not third-party content.
          onClick={() => window.open(BOUQUET_GAME_URL, "_blank")}
          style={{
            ...cellStyle(state.bouquet === "upload"),
            padding: "10px 6px 8px",
            borderStyle: state.bouquet === "upload" ? "solid" : "dashed",
          }}
        >
          <span
            aria-hidden
            className="mx-auto block"
            style={{ width: 34, height: 34 }}
          >
            {state.bouquetUpload ? (
              // A PNG handed off from the bouquet game — composited entirely
              // from MHacks' own flower and vase art, never an arbitrary
              // file — so there is nothing for next/image to optimize.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.bouquetUpload}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <span
                className="mh-glyph"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: "100%",
                  height: "100%",
                  fontSize: 17,
                  color: "var(--ui-ink-soft)",
                }}
              >
                {"[+]"}
              </span>
            )}
          </span>
          <span
            className="inline-flex items-center"
            style={{
              gap: 5,
              marginTop: 7,
              fontFamily: "var(--mh-ui-mono)",
              fontSize: 10,
              color: "var(--ui-ink)",
            }}
          >
            <Mark on={state.bouquet === "upload"} />
            Design
          </span>
        </button>
      </div>

      {/*
        The whole line is gated on the URL, not just the anchor. The standalone
        app rendered a dashed-underline placeholder with a "URL pending"
        tooltip while the bouquet game was unbuilt — in production that reads
        as a broken link. Setting BOUQUET_GAME_URL brings the copy back.
      */}
      {BOUQUET_GAME_URL && (
        <p style={helpStyle}>
          {BOUQUET_FINE_PRINT_PREFIX}
          {/* No rel="noreferrer": it also severs window.opener, which
              ExportPanel's "switch back to that tab" relies on. Fine to skip
              here — the link only ever points at our own bouquet route. */}
          <a
            href={BOUQUET_GAME_URL}
            target="_blank"
            style={{ color: "var(--ui-ink)", textDecoration: "underline" }}
          >
            {BOUQUET_FINE_PRINT_LINK}
          </a>
        </p>
      )}
    </div>
  );
}

/* ——— stickers ——— */

function StickerGroup<Id extends string>({
  legend,
  options,
  selected,
  onToggle,
  tint,
  ink,
}: {
  legend: string;
  options: StickerDef<Id>[];
  /** Always a list; single-select groups pass one entry or none. */
  selected: Id[];
  onToggle: (id: Id) => void;
  /** The pass's sticker colour, so the chip previews what lands on the pass. */
  tint: string;
  ink: string;
}) {
  return (
    <div role="group" aria-label={legend}>
      <p
        className="inline-flex items-center"
        style={{
          fontFamily: "var(--mh-ui-mono)",
          fontSize: 10,
          letterSpacing: "0.14em",
          color: "var(--ui-ink-soft)",
        }}
      >
        <span aria-hidden className="mh-glyph" style={{ marginRight: 6 }}>
          {"├─"}
        </span>
        {legend}
      </p>
      <div className="flex flex-wrap" style={{ marginTop: 8, gap: 7 }}>
        {options.map((option) => {
          const on = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option.id)}
              className="inline-flex items-center"
              style={{
                ...cellStyle(on),
                gap: 7,
                padding: "7px 11px",
                // The pass's own sticker colour shows on the chosen chip only,
                // so the picker previews what actually lands on the pass.
                background: on ? tint : "var(--ui-paper)",
                borderColor: on ? ink : "var(--ui-line)",
                color: on ? ink : "var(--ui-ink-soft)",
              }}
            >
              <Mark on={on} />
              {option.icon}
              <span
                style={{
                  fontFamily: "var(--mh-ui)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--ui-ink)",
                }}
              >
                {option.label}
                {option.count ? (
                  <span
                    style={{
                      marginLeft: 6,
                      fontFamily: "var(--mh-ui-mono)",
                      fontSize: 11,
                      fontWeight: 400,
                      color: "var(--ui-ink-soft)",
                    }}
                  >
                    ({option.count})
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StickerPicker({
  state,
  onChange,
}: {
  state: TicketState;
  onChange: Patch;
}) {
  /*
    Double majors are common, so study takes two. At the limit a new pick
    pushes the oldest one off rather than being ignored — a tap that does
    nothing reads as the control being broken.
  */
  function toggleStudy(id: StudyId) {
    const current = state.study;
    onChange({
      study: current.includes(id)
        ? current.filter((s) => s !== id)
        : [...current, id].slice(-STUDY_MAX),
    });
  }

  // One hue for all three groups, taken from whatever backdrop is chosen.
  const { vars } = ticketTheme(state.backdrop);
  const tint = vars["--mh-sticker-tint"];
  const ink = vars["--mh-sticker-ink"];

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <StickerGroup
        legend="year"
        options={YEARS}
        selected={state.year ? [state.year] : []}
        onToggle={(year) =>
          onChange({ year: state.year === year ? null : year })
        }
        tint={tint}
        ink={ink}
      />
      <StickerGroup
        legend={`area of study (select up to ${STUDY_MAX})`}
        options={STUDIES}
        selected={state.study}
        onToggle={toggleStudy}
        tint={tint}
        ink={ink}
      />
      <StickerGroup
        legend="experience · hackathons attended"
        options={EXPERIENCES}
        selected={state.experience ? [state.experience] : []}
        onToggle={(experience) =>
          onChange({
            experience: state.experience === experience ? null : experience,
          })
        }
        tint={tint}
        ink={ink}
      />
    </div>
  );
}

/* ——— section wrapper — every group is a console panel ——— */

export function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return <ConsoleBox label={label}>{children}</ConsoleBox>;
}
