"use client";

import type { CheckInResult } from "@/lib/actions/check-in.actions";
import {
  OUTCOME_GUIDANCE,
  OUTCOME_HEADLINE,
  OUTCOME_SEVERITY,
  SEVERITY_STYLE,
} from "@/lib/checkin/outcomes";

function timeOfDay(iso: string | undefined) {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * The verdict, flooded across the whole viewfinder.
 *
 * Sized to be read at arm's length across a noisy hall, which is why this is
 * not a toast: a corner card is unreadable at that distance and stacks when
 * scans come fast. Colour is never the only signal — the glyph and the headline
 * both carry the outcome for anyone who can't rely on it.
 */
export function ScanResult({
  result,
  onDismiss,
}: {
  result: CheckInResult;
  onDismiss: () => void;
}) {
  const severity = OUTCOME_SEVERITY[result.outcome];
  const { background, glyph } = SEVERITY_STYLE[severity];
  const guidance = OUTCOME_GUIDANCE[result.outcome];

  const checkedInAt = timeOfDay(result.checkedInAt);
  const scannedBy = result.ok ? null : result.checkedInByName;

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-live="assertive"
      style={{ backgroundColor: background }}
      className="absolute inset-0 z-20 flex w-full flex-col items-center justify-center gap-3 px-6 text-center text-white"
    >
      <span
        aria-hidden
        className="font-glyph text-[44px] leading-none tracking-[0.08em]"
      >
        {glyph}
      </span>

      <span className="font-red-hat-mono text-[15px] tracking-[0.16em] uppercase opacity-90">
        {OUTCOME_HEADLINE[result.outcome]}
      </span>

      {/* The name is the actual identity check — a volunteer reads it back
          against the person standing in front of them. */}
      <span className="max-w-[18ch] text-[30px] leading-[1.1] font-semibold text-balance">
        {result.attendee?.name ?? "Unknown code"}
      </span>

      {result.event ? (
        // Named on every result so a volunteer who opened the wrong scanner
        // finds out on their first scan rather than at the end of a shift.
        <span className="font-red-hat-mono text-[13px] tracking-[0.1em] opacity-85">
          {result.event.name}
        </span>
      ) : null}

      <span className="mt-1 h-px w-24 bg-white/35" />

      {result.attendee ? (
        <span className="font-red-hat-mono text-[12px] break-all opacity-80">
          {result.attendee.email}
          {result.attendee.university ? ` · ${result.attendee.university}` : ""}
        </span>
      ) : null}

      {/* On a duplicate this is the line that settles the argument at the door. */}
      {checkedInAt ? (
        <span className="font-red-hat-mono text-[12px] opacity-80">
          {result.ok ? "Checked in" : "Already in"} {checkedInAt}
          {scannedBy ? ` · by ${scannedBy}` : ""}
        </span>
      ) : null}

      {guidance ? (
        <span className="mt-1 max-w-[30ch] text-[13px] leading-[1.45] opacity-90">
          {guidance}
        </span>
      ) : null}

      <span className="mt-3 font-red-hat-mono text-[11px] tracking-[0.14em] uppercase opacity-60">
        Tap for next
      </span>
    </button>
  );
}
