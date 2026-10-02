"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PanelBar } from "@/components/console/panel";
import { TOOL_CARD_CLASS } from "@/components/console/tool-card";
import { syncLiveCalendarAction } from "@/lib/actions/live-calendar.server.actions";
import { cn } from "@/lib/utils";

/** "3 new · 1 updated · 52 unchanged" from the sync's per-action counts. */
function describe(changes: Record<string, number>) {
  const labels: [string, string][] = [
    ["insert", "new"],
    ["update", "updated"],
    ["archive", "archived"],
    ["unchanged", "unchanged"],
    ["missing (kept)", "missing from calendar (kept)"],
  ];
  const parts = labels
    .filter(([key]) => changes[key])
    .map(([key, label]) => `${changes[key]} ${label}`);
  return parts.length ? parts.join(" · ") : "No changes";
}

/**
 * Organizer tool that pulls the MHacks Google Calendar into the /live
 * schedule — the same import as `pnpm live:sync --apply --publish`. Lives in
 * the tool grid as a card like its neighbours, but it's an action, not a
 * link, so the bar shows its state instead of ↗.
 */
export function CalendarSyncCard() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  function sync() {
    startTransition(async () => {
      try {
        const res = await syncLiveCalendarAction();
        if (res.error === null) {
          const text = describe(res.summary.changes);
          setResult({ ok: true, text });
          toast.success("Calendar synced", { description: text });
        } else {
          setResult({ ok: false, text: res.error });
          toast.error("Calendar sync failed", { description: res.error });
        }
      } catch {
        const text = "Calendar sync failed. Try again in a moment.";
        setResult({ ok: false, text });
        toast.error(text);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={sync}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        TOOL_CARD_CLASS,
        "cursor-pointer text-left disabled:cursor-wait disabled:opacity-70",
      )}
    >
      <PanelBar
        eyebrow="LIVE SITE"
        status={pending ? "SYNCING…" : result?.ok === false ? "FAILED" : "⟳"}
      />

      <div className="flex flex-col gap-1.5 px-3 pt-3.5 pb-[15px]">
        <span className="font-red-hat-mono text-[15px] font-medium tracking-[-0.005em]">
          Sync calendar
        </span>
        <p
          className="text-[13px] leading-normal text-ui-ink-soft"
          aria-live="polite"
        >
          {result
            ? result.text
            : "Pull the MHacks Google Calendar into the /live schedule. New events publish; nothing is deleted."}
        </p>
      </div>
    </button>
  );
}
