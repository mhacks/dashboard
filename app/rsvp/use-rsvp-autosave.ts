"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { saveRsvpDraft } from "@/lib/actions/rsvp.server.actions";
import type { RsvpFormData } from "@/lib/types/rsvps";

export type RsvpSaveStatus = "idle" | "saving" | "saved" | "error";

export function useRsvpAutosave(initialVersion: number) {
  const [status, setStatus] = useState<RsvpSaveStatus>("idle");
  const latest = useRef<Partial<RsvpFormData>>({});
  const hasPending = useRef(false);
  const latestSequence = useRef(0);
  const version = useRef(initialVersion);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stopped = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const clearSavedTimer = useCallback(() => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = null;
  }, []);

  const markSaved = useCallback(() => {
    clearSavedTimer();
    setStatus("saved");
    savedTimer.current = setTimeout(() => setStatus("idle"), 3_000);
  }, [clearSavedTimer]);

  const persist = useCallback(
    async (data: Partial<RsvpFormData>, sequence: number) => {
      const operation = queue.current.then(async () => {
        const saved = await saveRsvpDraft({
          data,
          expectedVersion: version.current,
        });
        version.current = saved.version;
      });
      queue.current = operation.catch(() => undefined);

      try {
        await operation;
        if (!stopped.current && sequence === latestSequence.current) {
          hasPending.current = false;
          markSaved();
        }
      } catch {
        if (!stopped.current && sequence === latestSequence.current) {
          clearSavedTimer();
          setStatus("error");
        }
        throw new Error("Unable to save RSVP draft");
      }
    },
    [clearSavedTimer, markSaved],
  );

  const schedule = useCallback(
    (data: Partial<RsvpFormData>) => {
      if (stopped.current) return;
      latest.current = data;
      hasPending.current = true;
      latestSequence.current += 1;
      const sequence = latestSequence.current;
      clearTimer();
      clearSavedTimer();
      setStatus("saving");
      timer.current = setTimeout(() => {
        void persist(latest.current, sequence).catch(() => undefined);
      }, 1_500);
    },
    [clearSavedTimer, clearTimer, persist],
  );

  const flush = useCallback(async () => {
    if (stopped.current) return;
    clearTimer();
    if (!hasPending.current) {
      await queue.current;
      return;
    }
    latestSequence.current += 1;
    const sequence = latestSequence.current;
    clearSavedTimer();
    setStatus("saving");
    await persist(latest.current, sequence);
  }, [clearSavedTimer, clearTimer, persist]);

  const retry = useCallback(() => {
    void flush().catch(() => undefined);
  }, [flush]);

  const getVersion = useCallback(() => version.current, []);

  const cancelPending = useCallback(() => {
    clearTimer();
    hasPending.current = false;
  }, [clearTimer]);

  const completeExternalSave = useCallback(
    (data: Partial<RsvpFormData>, nextVersion: number) => {
      clearTimer();
      latest.current = data;
      version.current = nextVersion;
      hasPending.current = false;
      markSaved();
    },
    [clearTimer, markSaved],
  );

  const stop = useCallback(() => {
    stopped.current = true;
    clearTimer();
    clearSavedTimer();
  }, [clearSavedTimer, clearTimer]);

  useEffect(() => {
    return () => {
      stopped.current = true;
      clearTimer();
      clearSavedTimer();
    };
  }, [clearSavedTimer, clearTimer]);

  return {
    status,
    schedule,
    flush,
    retry,
    stop,
    getVersion,
    cancelPending,
    completeExternalSave,
  };
}
