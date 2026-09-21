import { QR_QUIET_ZONE, qrPath } from "@/lib/checkin/qr";

/**
 * A scannable QR code, rendered on the server as inline SVG.
 *
 * No `"use client"`, and that is the point: the finished markup ships in the
 * HTML, so the code is on screen the moment the page paints and keeps working
 * if the phone drops off the venue wifi afterwards. Anything that encodes in
 * the browser needs its chunk to arrive first, which is exactly what fails in
 * a hall where everyone is on one access point.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  /** Announced to screen readers in place of the code itself. */
  label: string;
  className?: string;
}) {
  const { size, path } = qrPath(value);
  const span = size + QR_QUIET_ZONE * 2;

  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={label}
      // Keeps module edges on pixel boundaries — antialiased edges soften the
      // contrast a camera is thresholding on.
      shapeRendering="crispEdges"
      className={className}
    >
      {/* Pure black on pure white, hardcoded and deliberately not themed. The
          console palette's ink is #17171a on #f6f6f4, which reads fine to a
          person and badly to a phone camera under warm light. This is the one
          surface in the product that is not allowed to be tasteful. */}
      <rect width={span} height={span} fill="#ffffff" />
      <path
        d={path}
        fill="#000000"
        transform={`translate(${QR_QUIET_ZONE} ${QR_QUIET_ZONE})`}
      />
    </svg>
  );
}
