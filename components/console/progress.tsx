/**
 * The application meter: one cell per section, inked as each is finished.
 *
 * The count is the graphic. A continuous bar says "somewhere past half", where
 * a cell per section says exactly how many are done and exactly how many are
 * left — the same information the number above it carries, in the studio's own
 * vocabulary of filled and empty marks.
 */
export function ProgressMeter({
  complete,
  total,
}: {
  complete: number;
  total: number;
}) {
  const percent = Math.round((complete / total) * 100);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3 font-red-hat-mono text-[10.5px] tracking-[0.04em] text-ui-ink-soft">
        <span>
          {complete} of {total} sections
        </span>
        <span className="tracking-[0.08em] tabular-nums text-ui-ink">
          {percent}%
        </span>
      </div>

      <div
        role="img"
        aria-label={`${complete} of ${total} sections complete, ${percent} percent`}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={
              i < complete
                ? "h-3.5 border border-ui-ink bg-ui-ink"
                : "h-3.5 border border-ui-line-strong bg-ui-well"
            }
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A status line in the studio's selection grammar: [x] for a thing that has
 * happened, [ ] for one that has not. It needs no legend because it is the
 * same mark the sticker picker uses to show what you have chosen.
 */
export function StatusLine({
  steps,
  note,
}: {
  steps: { label: string; done: boolean }[];
  /** Trailing detail, e.g. a submission date. */
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 font-red-hat-mono text-xs tracking-[0.02em] text-ui-ink">
      {steps.map((step) => (
        <span key={step.label}>
          <span
            aria-hidden
            className={`mr-1.5 font-glyph ${step.done ? "text-ui-ink" : "text-ui-line-strong"}`}
          >
            {step.done ? "[x]" : "[ ]"}
          </span>
          <span className="sr-only">{step.done ? "Done: " : "Not yet: "}</span>
          {step.label}
        </span>
      ))}

      {note ? (
        <span className="text-[10.5px] tracking-[0.04em] text-ui-ink-soft">
          {note}
        </span>
      ) : null}
    </div>
  );
}
