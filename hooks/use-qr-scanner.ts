"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  cameraFailureFrom,
  createDecoder,
  hasCameraApi,
  isSecureContextAvailable,
  type CameraFailure,
  type Decoder,
} from "@/lib/checkin/scanner";

export type ScannerState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "failed"; reason: CameraFailure };

export type TorchControl = {
  available: boolean;
  on: boolean;
  toggle: () => void;
};

/** Roughly 9fps when requestVideoFrameCallback isn't available. */
const FALLBACK_INTERVAL_MS = 110;

/**
 * Owns the camera stream and the decode loop.
 *
 * Decoding is paused rather than torn down while a result is on screen: on iOS
 * restarting a stream costs the better part of a second, which is the whole
 * gap between people in a moving queue.
 */
export function useQrScanner({
  videoRef,
  onCode,
  paused,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCode: (text: string) => void;
  paused: boolean;
}) {
  const [state, setState] = useState<ScannerState>({ kind: "idle" });
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const decoderRef = useRef<Decoder | null>(null);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const runningRef = useRef(false);
  /** Whether the camera was live when the page was last backgrounded. */
  const wasRunningRef = useRef(false);

  // Read inside the decode loop, which must not be re-created when either
  // changes — a new loop per render would multiply the frame callbacks.
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const cancelFrame = useCallback(() => {
    const video = videoRef.current;
    if (frameRef.current !== null) {
      video?.cancelVideoFrameCallback?.(frameRef.current);
      frameRef.current = null;
    }
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [videoRef]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelFrame();

    const stream = streamRef.current;
    streamRef.current = null;

    for (const track of stream?.getTracks() ?? []) {
      // Turn the torch off before releasing, or some Android devices leave the
      // LED lit until the next camera use.
      if (track.getSettings?.().torch) {
        void track
          .applyConstraints({ advanced: [{ torch: false }] })
          .catch(() => {});
      }
      track.stop();
    }

    const video = videoRef.current;
    if (video) {
      // Required on iOS: stopping the tracks alone leaves the camera indicator
      // on until the element itself lets go of the stream.
      video.srcObject = null;
    }

    setTorchOn(false);
    setTorchAvailable(false);
    setState({ kind: "idle" });
  }, [cancelFrame, videoRef]);

  const start = useCallback(async () => {
    if (runningRef.current) return;

    if (!isSecureContextAvailable()) {
      setState({ kind: "failed", reason: "insecure-context" });
      return;
    }
    if (!hasCameraApi()) {
      setState({ kind: "failed", reason: "unsupported" });
      return;
    }

    runningRef.current = true;
    setState({ kind: "starting" });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // `ideal`, never `exact`: exact throws OverconstrainedError on a
          // laptop with only a front camera, which is where this is developed.
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      // Unmounted, or stopped, while the permission prompt was open.
      if (!runningRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const [track] = stream.getVideoTracks();
      const capabilities = track?.getCapabilities?.();
      setTorchAvailable(Boolean(capabilities && "torch" in capabilities));

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        runningRef.current = false;
        return;
      }

      video.srcObject = stream;
      // videoWidth stays 0 until metadata lands, and decoding a 0x0 frame
      // throws rather than returning nothing.
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve) => {
          video.addEventListener("loadedmetadata", () => resolve(), {
            once: true,
          });
        });
      }
      // Rejects on some Safari builds even with autoplay+muted+playsInline.
      await video.play().catch(() => {});

      decoderRef.current ??= await createDecoder();

      if (!runningRef.current) return;
      setState({ kind: "scanning" });
      scheduleFrame();
    } catch (error) {
      runningRef.current = false;
      setState({ kind: "failed", reason: cameraFailureFrom(error) });
    }

    function scheduleFrame() {
      if (!runningRef.current) return;
      const video = videoRef.current;
      if (!video) return;

      // requestVideoFrameCallback fires only on genuinely new frames. The
      // timeout fallback is deliberately not rAF: 60fps through jsQR pegs the
      // CPU and cooks a phone within an hour of a check-in shift.
      if (typeof video.requestVideoFrameCallback === "function") {
        frameRef.current = video.requestVideoFrameCallback(() => void tick());
      } else {
        timerRef.current = setTimeout(() => void tick(), FALLBACK_INTERVAL_MS);
      }
    }

    async function tick() {
      if (!runningRef.current) return;

      const video = videoRef.current;
      const decode = decoderRef.current;

      if (!video || !decode || pausedRef.current || busyRef.current) {
        scheduleFrame();
        return;
      }

      busyRef.current = true;
      try {
        const text = await decode(video);
        if (text) onCodeRef.current(text);
      } catch {
        // A dropped frame is not worth surfacing; the next one is milliseconds
        // away.
      } finally {
        busyRef.current = false;
        scheduleFrame();
      }
    }
  }, [videoRef]);

  const toggleTorch = useCallback(() => {
    const [track] = streamRef.current?.getVideoTracks() ?? [];
    if (!track) return;

    const next = !torchOn;
    track
      .applyConstraints({ advanced: [{ torch: next }] })
      .then(() => setTorchOn(next))
      .catch(() => setTorchAvailable(false));
  }, [torchOn]);

  // iOS revokes the stream when the page is backgrounded and hands back a
  // frozen frame that looks alive. Tear down on hide, come back on show.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (runningRef.current) {
          wasRunningRef.current = true;
          stop();
        }
      } else if (wasRunningRef.current) {
        wasRunningRef.current = false;
        void start();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [start, stop]);

  useEffect(() => stop, [stop]);

  return {
    state,
    start,
    stop,
    torch: {
      available: torchAvailable,
      on: torchOn,
      toggle: toggleTorch,
    } satisfies TorchControl,
  };
}
