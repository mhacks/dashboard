"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { saveRsvpDraft } from "@/lib/actions/rsvp.server.actions";
import {
  rsvpDraftSchema,
  type RsvpDraftData,
  type RsvpFormData,
} from "@/lib/types/rsvps";

export type RsvpSaveStatus = "idle" | "saving" | "saved" | "error";

const PENDING_DRAFT_PREFIX = "mhacks-rsvp-pending-draft-v1";

type PendingDraftRecord = {
  ownerUserId: string;
  pending: RsvpDraftData;
  candidates: RsvpDraftData[];
};

function pendingDraftKey(userId: string): string {
  return `${PENDING_DRAFT_PREFIX}:${userId}`;
}

function canonicalize(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (typeof input !== "object" || input === null) return input;
    return Object.fromEntries(
      Object.entries(input)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  };
  return JSON.stringify(normalize(value));
}

export function clearStoredPendingRsvp(userId: string): void {
  try {
    sessionStorage.removeItem(pendingDraftKey(userId));
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
}

function storePendingDraft(
  userId: string,
  pending: Partial<RsvpFormData>,
  candidates: readonly Partial<RsvpFormData>[],
): void {
  try {
    sessionStorage.setItem(
      pendingDraftKey(userId),
      JSON.stringify({
        ownerUserId: userId,
        pending,
        candidates: candidates.slice(-4),
      }),
    );
  } catch {
    // The keepalive save remains the fallback when storage is unavailable.
  }
}

export function consumeRestorablePendingRsvp(
  userId: string,
  serverDraft: RsvpDraftData,
): RsvpDraftData | null {
  try {
    const raw = sessionStorage.getItem(pendingDraftKey(userId));
    if (!raw) return null;
    const record = JSON.parse(raw) as Partial<PendingDraftRecord>;
    if (record.ownerUserId !== userId) {
      clearStoredPendingRsvp(userId);
      return null;
    }
    const pending = rsvpDraftSchema.safeParse(record.pending);
    const candidates = Array.isArray(record.candidates)
      ? record.candidates
          .map((candidate) => rsvpDraftSchema.safeParse(candidate))
          .filter((candidate) => candidate.success)
          .map((candidate) => candidate.data)
      : [];
    clearStoredPendingRsvp(userId);
    if (!pending.success) return null;

    const serverValue = canonicalize(serverDraft);
    if (serverValue === canonicalize(pending.data)) return null;
    return candidates.some(
      (candidate) => canonicalize(candidate) === serverValue,
    )
      ? pending.data
      : null;
  } catch {
    clearStoredPendingRsvp(userId);
    return null;
  }
}

export function useRsvpAutosave(
  userId: string,
  initialVersion: number,
  initialData: RsvpDraftData,
) {
  const [status, setStatus] = useState<RsvpSaveStatus>("idle");
  const latest = useRef<Partial<RsvpFormData>>({});
  const hasPending = useRef(false);
  const latestSequence = useRef(0);
  const version = useRef(initialVersion);
  const persistedData = useRef<Partial<RsvpFormData>>(initialData);
  const inFlightData = useRef<Partial<RsvpFormData>[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stopped = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const persist = useCallback(
    async (data: Partial<RsvpFormData>, sequence: number) => {
      inFlightData.current.push(data);
      storePendingDraft(userId, latest.current, [
        persistedData.current,
        ...inFlightData.current,
      ]);
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
        inFlightData.current = inFlightData.current.filter(
          (candidate) => candidate !== data,
        );
        persistedData.current = data;
        if (!stopped.current && sequence === latestSequence.current) {
          hasPending.current = false;
          clearStoredPendingRsvp(userId);
          setStatus("saved");
        } else {
          storePendingDraft(userId, latest.current, [
            persistedData.current,
            ...inFlightData.current,
          ]);
        }
      } catch {
        inFlightData.current = inFlightData.current.filter(
          (candidate) => candidate !== data,
        );
        storePendingDraft(userId, latest.current, [
          persistedData.current,
          ...inFlightData.current,
        ]);
        if (!stopped.current && sequence === latestSequence.current) {
          setStatus("error");
        }
        throw new Error("Unable to save RSVP draft");
      }
    },
    [userId],
  );

  const schedule = useCallback(
    (data: Partial<RsvpFormData>) => {
      if (stopped.current) return;
      latest.current = data;
      hasPending.current = true;
      storePendingDraft(userId, data, [
        persistedData.current,
        ...inFlightData.current,
      ]);
      latestSequence.current += 1;
      const sequence = latestSequence.current;
      clearTimer();
      setStatus("saving");
      timer.current = setTimeout(() => {
        void persist(latest.current, sequence).catch(() => undefined);
      }, 1_500);
    },
    [clearTimer, persist, userId],
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
    setStatus("saving");
    await persist(latest.current, sequence);
  }, [clearTimer, persist]);

  const retry = useCallback(() => {
    void flush().catch(() => undefined);
  }, [flush]);

  const updateVersion = useCallback((nextVersion: number) => {
    version.current = Math.max(version.current, nextVersion);
  }, []);

  const getVersion = useCallback(() => version.current, []);

  const cancelPending = useCallback(() => {
    clearTimer();
    hasPending.current = false;
    clearStoredPendingRsvp(userId);
  }, [clearTimer, userId]);

  const completeExternalSave = useCallback(
    (data: Partial<RsvpFormData>, nextVersion: number) => {
      clearTimer();
      latest.current = data;
      persistedData.current = data;
      version.current = nextVersion;
      hasPending.current = false;
      clearStoredPendingRsvp(userId);
      setStatus("saved");
    },
    [clearTimer, userId],
  );

  const stop = useCallback(() => {
    stopped.current = true;
    clearTimer();
    clearStoredPendingRsvp(userId);
  }, [clearTimer, userId]);

  useEffect(() => {
    const persistPendingOnPageHide = () => {
      if (stopped.current || !timer.current || !hasPending.current) return;
      clearTimer();
      storePendingDraft(userId, latest.current, [
        persistedData.current,
        ...inFlightData.current,
      ]);
      const body = JSON.stringify({
        data: latest.current,
        expectedVersion: version.current,
      });
      void fetch("/rsvp/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        credentials: "same-origin",
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", persistPendingOnPageHide);
    return () => {
      window.removeEventListener("pagehide", persistPendingOnPageHide);
      stopped.current = true;
      clearTimer();
    };
  }, [clearTimer, userId]);

  return {
    status,
    schedule,
    flush,
    retry,
    stop,
    updateVersion,
    getVersion,
    cancelPending,
    completeExternalSave,
  };
}
