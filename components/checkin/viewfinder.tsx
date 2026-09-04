"use client";

import { FlashlightIcon, FlashlightOffIcon } from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import type { ScannerState } from "@/hooks/use-qr-scanner";
import type { TorchControl } from "@/hooks/use-qr-scanner";
import type { CameraFailure } from "@/lib/checkin/scanner";

/** Every failure gets a cause and a way forward, never just "camera error". */
const FAILURE_COPY: Record<CameraFailure, string> = {
  denied:
    "Camera access is blocked. Allow the camera in your browser's site settings and reload — you can search by name below in the meantime.",
  "insecure-context":
    "The camera needs a secure connection. Open this page over https rather than an IP address.",
  unsupported: "This browser can't open the camera. Try Chrome or Safari.",
  "not-found": "No camera found on this device.",
  "in-use": "Another app is using the camera. Close it and tap Retry.",
  unknown: "The camera wouldn't start. Tap Retry, or search by name below.",
};

export function Viewfinder({
  videoRef,
  state,
  torch,
  onStart,
  children,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  state: ScannerState;
  torch: TorchControl;
  onStart: () => void;
  /** The result overlay, absolutely positioned over the video. */
  children?: React.ReactNode;
}) {
  const failed = state.kind === "failed";

  return (
    <div className="relative aspect-square w-full overflow-hidden border border-ui-line bg-black">
      {/* playsInline/muted/autoPlay are all required or iOS renders nothing.
          The element stays mounted across states so the stream isn't torn
          down and re-acquired every time a result appears. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="h-full w-full object-cover"
      />

      {state.kind === "scanning" ? <Reticle /> : null}

      {state.kind === "idle" || failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
          {failed ? (
            <>
              <p className="font-red-hat-mono text-[12px] tracking-[0.16em] text-amber-300 uppercase">
                Camera unavailable
              </p>
              <p className="max-w-[34ch] text-[13px] leading-[1.5] text-white/80">
                {FAILURE_COPY[state.reason]}
              </p>
            </>
          ) : (
            <p className="max-w-[30ch] text-[13px] leading-[1.5] text-white/75">
              Point the camera at a hacker&apos;s check-in code.
            </p>
          )}

          <Button type="button" onClick={onStart} variant="secondary" size="lg">
            {failed ? "Retry camera" : "Start scanning"}
          </Button>
        </div>
      ) : null}

      {state.kind === "starting" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="font-red-hat-mono text-[12px] tracking-[0.16em] text-white/70 uppercase">
            Starting camera…
          </p>
        </div>
      ) : null}

      {/* Android only. A flashlight button that does nothing on an iPhone is
          worse than no button, so it renders only where the track reports it. */}
      {torch.available && state.kind === "scanning" ? (
        <Button
          type="button"
          size="icon-lg"
          variant="secondary"
          onClick={torch.toggle}
          aria-pressed={torch.on}
          aria-label={torch.on ? "Turn off flashlight" : "Turn on flashlight"}
          className="absolute right-3 bottom-3 z-10 rounded-full"
        >
          {torch.on ? <FlashlightIcon /> : <FlashlightOffIcon />}
        </Button>
      ) : null}

      {children}
    </div>
  );
}

/**
 * Marks the square the decoder actually reads. The jsQR path crops to a centred
 * square, so this is not decoration — a code outside it genuinely won't scan.
 */
function Reticle() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div className="relative h-[62%] w-[62%]">
        {[
          "top-0 left-0 border-t-2 border-l-2",
          "top-0 right-0 border-t-2 border-r-2",
          "bottom-0 left-0 border-b-2 border-l-2",
          "bottom-0 right-0 border-b-2 border-r-2",
        ].map((corner) => (
          <span
            key={corner}
            className={`absolute h-7 w-7 border-white/80 ${corner}`}
          />
        ))}
      </div>
    </div>
  );
}
