interface Detail {
  icon: string;
  label: string;
  value: string;
  /** Spans both columns on desktop. */
  wide?: boolean;
}

const DETAILS: Detail[] = [
  { icon: "📅", label: "Dates", value: "October 3–4, 2026" },
  {
    icon: "⏰",
    label: "Venue Access",
    value: "Open 24 hours throughout the weekend",
  },
  {
    icon: "📍",
    label: "Location",
    value: "University of Michigan — North Campus, Ann Arbor, MI",
    wide: true,
  },
  {
    icon: "ℹ️",
    label: "Accommodations",
    value:
      "Overnight venue access is provided; formal hotel/sleeping accommodations are not offered.",
    wide: true,
  },
];

export function EventDetails() {
  return (
    <section
      aria-labelledby="event-details-title"
      className="border-t border-ink/15 bg-haze px-[22px] pt-6 pb-9 sm:px-[34px]"
    >
      <p
        id="event-details-title"
        className="font-red-hat mb-4 text-[11px] font-semibold tracking-[0.28em] text-olive uppercase"
      >
        Event Details
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DETAILS.map((detail) => (
          <div
            key={detail.label}
            className={`rounded-tile border border-ink/15 bg-paper px-[18px] py-4 ${
              detail.wide ? "sm:col-span-2" : ""
            }`}
          >
            <span className="font-red-hat mb-1 block text-[11px] font-semibold tracking-[0.14em] text-ink/60 uppercase">
              {detail.icon} {detail.label}
            </span>
            <p className="text-[14.5px] leading-normal text-ink">
              {detail.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
