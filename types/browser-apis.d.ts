/**
 * Ambient declarations for browser APIs the check-in scanner uses that
 * TypeScript's `lib.dom` does not model.
 *
 * `lib.dom` tracks what is broadly shipped, so anything Chromium-only is
 * missing. These are the two gaps the scanner actually hits — nothing else
 * belongs in this file. `requestVideoFrameCallback`, `navigator.wakeLock` and
 * `navigator.vibrate` are already typed; redeclaring them is a duplicate
 * identifier error, not a no-op.
 */

/**
 * TS 5.9 puts `torch` on `MediaTrackSettings` only — not on the capabilities
 * we read to decide whether to show the button, nor on the constraint set we
 * write to toggle it. Those two are exactly what a torch control touches.
 */
interface MediaTrackCapabilities {
  torch?: boolean;
}

interface MediaTrackConstraintSet {
  torch?: ConstrainBoolean;
}

/**
 * The Barcode Detection API. Absent from `lib.dom` because WebKit has never
 * shipped it, which is also why the scanner keeps a jsQR fallback rather than
 * treating this as the decoder.
 *
 * `string & {}` keeps the other symbologies assignable without widening the
 * union to plain `string` and losing autocomplete on "qr_code".
 */
type BarcodeFormat = "qr_code" | (string & {});

interface DetectedBarcode {
  rawValue: string;
  format: BarcodeFormat;
  boundingBox: DOMRectReadOnly;
  cornerPoints: ReadonlyArray<{ x: number; y: number }>;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: BarcodeFormat[] });
  static getSupportedFormats(): Promise<BarcodeFormat[]>;
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
