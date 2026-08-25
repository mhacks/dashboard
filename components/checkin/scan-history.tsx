"use client";

import {
  OUTCOME_HEADLINE,
  SEVERITY_STYLE,
  type ScanSeverity,
} from "@/lib/checkin/outcomes";

export type ScanHistoryEntry = {
  /** The client scan id — unique per attempt, so retries don't double-list. */
  id: string;
  name: string;
  headline: string;
  severity: ScanSeverity;
  at: string;
};

export const SCAN_HISTORY_LIMIT = 5;

/**
 * The last few scans, kept on screen under the viewfinder.
 *
 * This is what lets the result overlay clear itself after a couple of seconds:
 * a volunteer who looks up a moment too late still has the record in front of
 * them, so the queue never has to stop moving.
 */
export function ScanHistory({
  entries,
  checkedInCount,
  eventName,
}: {
  entries: ScanHistoryEntry[];
  /** People admitted to this event — never a count of the rows below. */
  checkedInCount: number;
  eventName: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      {/* The event total, on its own line above the list. It counts people
          admitted to this event — not rows below, which also hold the codes
          that were turned away. Sharing a line with "Recent scans" read as a
          tally of that list. */}
      <div className="flex items-baseline justify-between gap-3 border border-ui-line bg-ui-well px-3 py-2">
        <span className="font-red-hat-mono text-[11px] tracking-[0.18em] text-ui-ink-soft uppercase">
          Checked in to {eventName}
        </span>
        <span className="font-red-hat-mono text-[17px] leading-none font-bold text-ui-ink tabular-nums">
          {checkedInCount}
        </span>
      </div>

      <h2 className="mt-1 font-red-hat-mono text-[11px] tracking-[0.18em] text-ui-ink-soft uppercase">
        Recent scans
      </h2>

      {entries.length === 0 ? (
        <p className="border border-dashed border-ui-line px-3 py-4 text-center text-[12px] text-ui-ink-soft">
          Nothing scanned yet.
        </p>
      ) : (
        <ul className="flex flex-col border border-ui-line">
          {entries.slice(0, SCAN_HISTORY_LIMIT).map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2.5 border-b border-ui-line px-3 py-2 last:border-b-0"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: SEVERITY_STYLE[entry.severity].background,
                }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ui-ink">
                {entry.name}
              </span>
              <span className="shrink-0 font-red-hat-mono text-[11px] text-ui-ink-soft">
                {entry.headline === OUTCOME_HEADLINE["checked-in"]
                  ? entry.at
                  : entry.headline}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
