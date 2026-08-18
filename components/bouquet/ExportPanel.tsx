"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { STICKER_BORDERS, TICKET_URL } from "@/lib/bouquet/catalog";
import type { PlacedStem } from "@/lib/bouquet/geometry";
import { canvasToBlob, renderSticker } from "@/lib/bouquet/sticker";

type Props = {
  open: boolean;
  bouquet: PlacedStem[];
  order: string[];
  vaseId: string;
  borderColor: string;
  onBorder: (hex: string) => void;
  onBack: () => void;
  onRestart: () => void;
};

export default function ExportPanel({
  open,
  bouquet,
  order,
  vaseId,
  borderColor,
  onBorder,
  onBack,
  onRestart,
}: Props) {
  const [preview, setPreview] = useState<{ key: string; src: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const build = useCallback(
    (scale: number) =>
      renderSticker(bouquet, order, vaseId, borderColor, scale),
    [bouquet, order, vaseId, borderColor],
  );

  /* Everything the render depends on, as one comparable key. Tagging the
     cached preview with it means a stale image is simply never shown — no
     clearing setState in the effect body (which cascades renders), and no
     flash of the previous bouquet when the panel reopens. */
  const key = useMemo(
    () =>
      JSON.stringify({
        v: vaseId,
        b: borderColor,
        o: order,
        s: bouquet.map((s) => [
          s.uid,
          s.flowerId,
          s.slot,
          s.rotation,
          s.height,
          s.flip,
        ]),
      }),
    [vaseId, borderColor, order, bouquet],
  );

  // the preview renders at a fraction of full size; every dimension is
  // proportional, so it is an honest preview of the export
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    build(0.55).then((cv) => {
      if (!cancelled) setPreview({ key, src: cv.toDataURL("image/png") });
    });
    return () => {
      cancelled = true;
    };
  }, [open, key, build]);

  const src = open && preview?.key === key ? preview.src : "";

  async function download() {
    setBusy(true);
    try {
      const cv = await build(2); // supersampled
      const blob = await canvasToBlob(cv);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bouquet-sticker.png";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-panel">
      <h2>wrap it up</h2>
      <p className="ep-sub">
        Use your unique sticker to decorate your{" "}
        <a
          className="ep-link"
          href={TICKET_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          MHacks ticket
        </a>
        !
      </p>

      <div className="ep-swatches">
        <span className="ep-swatch-label">border</span>
        <div className="ep-swatch-row">
          {STICKER_BORDERS.map((b) => (
            <button
              key={b.id}
              className={`ep-swatch${b.hex === borderColor ? " active" : ""}`}
              style={{ background: b.hex }}
              aria-label={`${b.name} border`}
              onClick={() => onBorder(b.hex)}
            />
          ))}
        </div>
      </div>

      <div className={`ep-preview${src ? " ready" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src && <img src={src} alt="sticker preview" />}
        <span className="ep-spinner">rendering&hellip;</span>
      </div>

      <p className="ep-meta">die-cut PNG · transparent background</p>

      <div className="ep-actions">
        <button
          className="pill solid"
          onClick={download}
          disabled={!src || busy}
        >
          download
        </button>
      </div>

      {/* `keep editing` leaves the arrangement and the undo history untouched,
          so you can adjust one stem and wrap again — unlike `start over`. */}
      <div className="ep-footlinks">
        <button className="ep-textlink" onClick={onBack}>
          &larr; keep editing
        </button>
        <span className="ep-dot">·</span>
        <button className="ep-textlink" onClick={onRestart}>
          start over
        </button>
      </div>
    </div>
  );
}
