import { LetterBody, LetterKicker } from "@/components/console/letter";
import { LINKS } from "@/lib/config/links";

interface Detail {
  label: string;
  value: string;
  /** Spans the full row on desktop. */
  wide?: boolean;
}

/**
 * The emoji that used to open each label are gone. They were carrying no
 * information the label did not already carry, and in a console of rails,
 * hairlines and mono they were the only rounded, full-colour thing on the
 * screen. The labels themselves are unchanged.
 */
const DETAILS: Detail[] = [
  { label: "Dates", value: "October 3–4, 2026" },
  { label: "Venue Access", value: "Open 24 hours throughout the weekend" },
  {
    label: "Location",
    value: "University of Michigan — North Campus, Ann Arbor, MI",
    wide: true,
  },
  {
    label: "Accommodations",
    value:
      "Overnight venue access is provided; formal hotel/sleeping accommodations are not offered.",
    wide: true,
  },
];

export function EventDetails() {
  return (
    <>
      <LetterKicker>Event Details</LetterKicker>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-2.5">
        {DETAILS.map((detail) => (
          <div
            key={detail.label}
            className={`border border-ui-line bg-ui-paper px-[15px] pt-[13px] pb-3.5 ${
              detail.wide ? "col-span-full" : ""
            }`}
          >
            <span className="mb-1.5 block font-red-hat-mono text-[10px] tracking-[0.16em] uppercase text-ui-ink-soft">
              {detail.label}
            </span>
            <p className="text-sm leading-snug text-ui-ink">{detail.value}</p>
          </div>
        ))}
      </div>

      <LetterBody>
        Read the{" "}
        <a
          href={LINKS.documents.travelGuide}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-4"
        >
          MHacks 2026 Travel Guide
        </a>{" "}
        for everything you need to know about getting to Ann Arbor.
      </LetterBody>
    </>
  );
}
