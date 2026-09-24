/**
 * Camera plumbing for the check-in scanner. Browser-only, but deliberately not
 * marked "use client" — it exports plain functions, and the hook that owns the
 * React state is the client boundary.
 */

/** Why the camera isn't running. Each one gets its own sentence on screen. */
export type CameraFailure =
  | "insecure-context"
  | "unsupported"
  | "denied"
  | "not-found"
  | "in-use"
  | "unknown";

/**
 * Maps a getUserMedia rejection onto something explainable.
 *
 * `DOMException.name` is the only part of this browsers actually agree on —
 * the messages differ wildly, so nothing here reads `err.message`.
 */
export function cameraFailureFrom(error: unknown): CameraFailure {
  if (!isSecureContextAvailable()) return "insecure-context";
  if (!hasCameraApi()) return "unsupported";

  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "not-found";
    case "NotReadableError":
    case "AbortError":
      return "in-use";
    default:
      return "unknown";
  }
}

/**
 * getUserMedia is undefined outside a secure context, so a phone pointed at a
 * LAN dev server over plain http fails here rather than at the permission
 * prompt. Worth its own failure so it never gets misdiagnosed as "denied".
 */
export function isSecureContextAvailable() {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function hasCameraApi() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** Reads one frame. Returns the decoded text, or null if no code was in it. */
export type Decoder = (video: HTMLVideoElement) => Promise<string | null>;

/** Square crop fed to jsQR — matches the on-screen reticle. */
const DECODE_SIZE = 480;

/**
 * Picks a decoder once per scanner session.
 *
 * Native BarcodeDetector where it exists (Chromium; hardware-accelerated, zero
 * bytes to download), and jsQR everywhere else — which in practice means every
 * iPhone, since WebKit has never shipped the Barcode Detection API. jsQR is
 * imported dynamically so it stays out of every bundle but this screen's.
 */
export async function createDecoder(): Promise<Decoder> {
  const native = await tryNativeDecoder();
  if (native) return native;

  const { default: jsQR } = await import("jsqr");

  const canvas = document.createElement("canvas");
  canvas.width = DECODE_SIZE;
  canvas.height = DECODE_SIZE;
  // Signals to the browser that getImageData is the point, which keeps the
  // surface in software memory instead of round-tripping the GPU each frame.
  const context = canvas.getContext("2d", { willReadFrequently: true });

  return async (video) => {
    if (!context || !video.videoWidth || !video.videoHeight) return null;

    const side = Math.min(video.videoWidth, video.videoHeight);
    context.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      DECODE_SIZE,
      DECODE_SIZE,
    );

    const frame = context.getImageData(0, 0, DECODE_SIZE, DECODE_SIZE);
    // Roughly twice as fast, and correct here: our codes are always dark on
    // light, so anything inverted belongs to somebody else's system.
    const found = jsQR(frame.data, DECODE_SIZE, DECODE_SIZE, {
      inversionAttempts: "dontInvert",
    });
    return found?.data ?? null;
  };
}

async function tryNativeDecoder(): Promise<Decoder | null> {
  if (typeof BarcodeDetector === "undefined") return null;

  try {
    const formats = await BarcodeDetector.getSupportedFormats();
    if (!formats.includes("qr_code")) return null;

    const detector = new BarcodeDetector({ formats: ["qr_code"] });

    // Some Android builds expose the constructor while the platform barcode
    // backend is missing, and only fail on the first real detect(). Smoke-test
    // it now rather than silently dropping every frame at the door.
    const probe = document.createElement("canvas");
    probe.width = 2;
    probe.height = 2;
    await detector.detect(probe);

    return async (video) => {
      if (!video.videoWidth) return null;
      const found = await detector.detect(video);
      return found[0]?.rawValue ?? null;
    };
  } catch {
    return null;
  }
}
