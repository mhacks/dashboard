"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ManualEntry } from "@/components/checkin/manual-entry";
import {
  ScanHistory,
  type ScanHistoryEntry,
} from "@/components/checkin/scan-history";
import { ScanResult } from "@/components/checkin/scan-result";
import { Viewfinder } from "@/components/checkin/viewfinder";
import { useQrScanner } from "@/hooks/use-qr-scanner";
import type { CheckInResult } from "@/lib/actions/check-in.actions";
import { checkInAttendeeAction } from "@/lib/actions/check-in.server.actions";
import { signalScan, unlockFeedbackAudio } from "@/lib/checkin/feedback";
import {
  countsAsCheckIn,
  OUTCOME_HEADLINE,
  OUTCOME_SEVERITY,
} from "@/lib/checkin/outcomes";

type Phase =
  // Nothing over the viewfinder. Whether that means a live scan or a camera
  // that was never started is the hook's business, not this state's — keeping
  // a second copy of it here only lets the two drift apart.
  | { kind: "ready" }
  | { kind: "submitting"; since: number }
  | { kind: "result"; result: CheckInResult }
  | {
      kind: "network-error";
      code: string;
      scanId: string;
      method: "scan" | "manual";
    };

/** How long a verdict stays up before the scanner re-arms itself. */
const DISMISS_MS: Record<"go" | "warn" | "stop", number> = {
  go: 2200,
  warn: 2200,
  // A red has to be read, not glanced at.
  stop: 4000,
};

/** A badge held in frame decodes many times a second; ignore the repeats. */
const SAME_CODE_COOLDOWN_MS = 4000;
const SLOW_NETWORK_MS = 3000;
const HISTORY_LIMIT = 20;

export function CheckInScanner({
  slug,
  eventName,
  initialCheckedInCount,
}: {
  slug: string;
  eventName: string;
  initialCheckedInCount: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [checkedInCount, setCheckedInCount] = useState(initialCheckedInCount);
  const [isOffline, setIsOffline] = useState(false);
  const [isSlow, setIsSlow] = useState(false);

  // Read inside the decode loop, so they must not force it to re-subscribe.
  const lastCodeRef = useRef<{ text: string; at: number } | null>(null);
  const inFlightRef = useRef(false);

  const record = useCallback((result: CheckInResult, scanId: string) => {
    const severity = OUTCOME_SEVERITY[result.outcome];
    signalScan(severity);

    setHistory((entries) =>
      [
        {
          id: scanId,
          name: result.attendee?.name ?? "Unrecognised code",
          headline: OUTCOME_HEADLINE[result.outcome],
          severity,
          at: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
        },
        ...entries,
      ].slice(0, HISTORY_LIMIT),
    );

    // Only a genuine arrival moves the total. An unrecognised code or a
    // duplicate is a scan, not a person, and belongs in the list above rather
    // than in this number.
    if (countsAsCheckIn(result.outcome)) {
      setCheckedInCount((count) => count + 1);
    }
    setPhase({ kind: "result", result });
  }, []);

  const submit = useCallback(
    async (code: string, method: "scan" | "manual", scanId: string) => {
      inFlightRef.current = true;
      setPhase({ kind: "submitting", since: Date.now() });

      const attempt = () =>
        checkInAttendeeAction({ slug, code, clientScanId: scanId, method });

      try {
        let result: CheckInResult;
        try {
          result = await attempt();
        } catch {
          // One silent retry on the same scan id, so the server replays what it
          // already recorded rather than acting twice. Past that it becomes the
          // volunteer's decision rather than ours.
          result = await attempt();
        }
        record(result, scanId);
      } catch {
        setPhase({ kind: "network-error", code, scanId, method });
      } finally {
        inFlightRef.current = false;
        setIsSlow(false);
      }
    },
    [record, slug],
  );

  const handleCode = useCallback(
    (text: string) => {
      const now = Date.now();
      const last = lastCodeRef.current;
      if (last?.text === text && now - last.at < SAME_CODE_COOLDOWN_MS) return;
      if (inFlightRef.current) return;

      lastCodeRef.current = { text, at: now };

      // Even a code that is obviously not one of ours goes to the server. It
      // answers unknown-code exactly as this used to answer locally, and the
      // trip buys the thing a local verdict cannot: a row in the scan log
      // holding the text that was actually waved at the door, which is the
      // whole reason event_scan_log.raw_code exists.
      void submit(text, "scan", crypto.randomUUID());
    },
    [submit],
  );

  const scanner = useQrScanner({
    videoRef,
    onCode: handleCode,
    // The camera keeps streaming while a verdict is up — only decoding stops.
    // Restarting a stream costs the better part of a second on iOS.
    paused: phase.kind !== "ready",
    // iOS suspends the AudioContext along with the camera when the page is
    // backgrounded, and the hook brings the camera back on its own without
    // going through `start` below. Without this the scanner looks fine on
    // return and scans in silence — which at a loud door is most of the signal
    // a volunteer gets.
    onAutoRestart: unlockFeedbackAudio,
  });

  const start = useCallback(() => {
    // The same gesture that starts the camera unlocks audio, which iOS will
    // only allow from inside a real user interaction.
    unlockFeedbackAudio();
    void scanner.start();
    setPhase({ kind: "ready" });
  }, [scanner]);

  const dismiss = useCallback(() => {
    lastCodeRef.current = null;
    setPhase({ kind: "ready" });
  }, []);

  // Auto re-arm. A volunteer with forty people in line will not tap "next".
  useEffect(() => {
    if (phase.kind !== "result") return;
    const severity = OUTCOME_SEVERITY[phase.result.outcome];
    const timer = setTimeout(dismiss, DISMISS_MS[severity]);
    return () => clearTimeout(timer);
  }, [phase, dismiss]);

  // Swap the spinner's copy rather than racing a timeout against the action —
  // a Server Action can't be aborted, so racing would show a failure for a
  // request that actually succeeded.
  useEffect(() => {
    if (phase.kind !== "submitting") return;
    const timer = setTimeout(() => setIsSlow(true), SLOW_NETWORK_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {isOffline ? (
        // navigator.onLine lies about captive portals, so this is advisory —
        // but it turns a confusing hang into an explanation.
        <p className="border border-amber-500/50 bg-amber-50 px-3 py-2 text-center font-red-hat-mono text-[11.5px] tracking-[0.06em] text-amber-900">
          No network. Scans can&apos;t be recorded until this clears.
        </p>
      ) : null}

      <Viewfinder
        videoRef={videoRef}
        state={scanner.state}
        torch={scanner.torch}
        onStart={start}
      >
        {phase.kind === "result" ? (
          <ScanResult result={phase.result} onDismiss={dismiss} />
        ) : null}

        {phase.kind === "submitting" ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
            <p className="font-red-hat-mono text-[12px] tracking-[0.14em] text-white uppercase">
              {isSlow ? "Slow network — still working" : "Checking…"}
            </p>
          </div>
        ) : null}

        {phase.kind === "network-error" ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
            <p className="font-red-hat-mono text-[13px] tracking-[0.14em] text-amber-300 uppercase">
              Couldn&apos;t reach the server
            </p>
            <p className="max-w-[30ch] text-[13px] leading-[1.45] text-white/80">
              Nothing was recorded. Retry, or wave them through and tell a lead.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  void submit(phase.code, phase.method, phase.scanId)
                }
                className="rounded-[2px] border border-white/70 px-4 py-2 font-red-hat-mono text-[12px] text-white"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-[2px] px-4 py-2 font-red-hat-mono text-[12px] text-white/70"
              >
                Skip
              </button>
            </div>
          </div>
        ) : null}
      </Viewfinder>

      <ScanHistory
        entries={history}
        checkedInCount={checkedInCount}
        eventName={eventName}
      />

      <ManualEntry
        slug={slug}
        disabled={phase.kind === "submitting"}
        onPick={(userId) => void submit(userId, "manual", crypto.randomUUID())}
      />
    </div>
  );
}
