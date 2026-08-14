"use client";

import { useState, useTransition } from "react";

import { buttonClass } from "@/components/console/button";

/**
 * The only interactive piece in the letter, and therefore the only client
 * component in it — everything else stays a server component.
 */
export function RsvpButton({
  deadline,
  onConfirm,
  initiallyConfirmed = false,
}: {
  /** Human-readable deadline, e.g. "September 26, 2026". */
  deadline?: string;
  onConfirm: () => Promise<void>;
  /** Render already-confirmed, for a revisit after RSVP. */
  initiallyConfirmed?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(initiallyConfirmed);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (confirmed || isPending) return;

    setError(null);
    startTransition(async () => {
      try {
        await onConfirm();
        setConfirmed(true);
      } catch {
        // Never strand the applicant on a silent failure — this is the one
        // action with a deadline attached.
        setError("That didn't go through. Please try again.");
      }
    });
  }

  return (
    <div className="mt-5.5 flex flex-wrap items-center gap-3.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={confirmed || isPending}
        aria-live="polite"
        className={
          confirmed
            ? buttonClass(
                "secondary",
                "cursor-default hover:translate-y-0 hover:bg-ui-selected",
              )
            : buttonClass("primary")
        }
      >
        {/* Confirmed, the prompt becomes the studio's filled mark: the button
            stops asking for the action and starts reporting it. */}
        <span aria-hidden className="font-glyph select-none">
          {confirmed ? "[x]" : ">"}
        </span>
        {confirmed
          ? "RSVP Confirmed"
          : isPending
            ? "Confirming…"
            : "Confirm My RSVP"}
      </button>

      <p className="font-red-hat-mono text-[11.5px] tracking-[0.04em] text-ui-ink-soft max-sm:w-full">
        {confirmed
          ? "Your spot is locked in"
          : deadline
            ? `RSVP by ${deadline}`
            : null}
      </p>

      {error ? (
        <p role="alert" className="w-full text-sm text-red-900">
          {error}
        </p>
      ) : null}
    </div>
  );
}
