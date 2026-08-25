export const RSVP_RECEIPT_CONTENT_TYPE = "application/pdf";

export type RsvpReceiptContentType = typeof RSVP_RECEIPT_CONTENT_TYPE;

export const MAX_RSVP_RECEIPT_SIZE_BYTES = 20 * 1024 * 1024;

export function receiptKeyForUser(userId: string): string {
  return `rsvp-receipts/${userId}`;
}

export function rsvpReceiptKeyBelongsToUser(
  key: string,
  userId: string,
): boolean {
  return key === receiptKeyForUser(userId);
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46] as const;

export function isRsvpReceiptContentType(
  value: string,
): value is RsvpReceiptContentType {
  return value === RSVP_RECEIPT_CONTENT_TYPE;
}

export function assertValidRsvpReceipt({
  contentType,
  sizeBytes,
  leadingBytes,
}: {
  contentType: string;
  sizeBytes: number;
  leadingBytes: Uint8Array;
}): void {
  if (!isRsvpReceiptContentType(contentType)) {
    throw new Error("Receipt must be a PDF");
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Receipt cannot be empty");
  }
  if (sizeBytes > MAX_RSVP_RECEIPT_SIZE_BYTES) {
    throw new Error("Receipt exceeds the 20MB limit");
  }

  if (!receiptSignatureMatches(contentType, leadingBytes)) {
    throw new Error("Receipt must be a valid PDF");
  }
}

function receiptSignatureMatches(
  contentType: RsvpReceiptContentType,
  leadingBytes: Uint8Array,
): boolean {
  if (contentType === RSVP_RECEIPT_CONTENT_TYPE) {
    return PDF_SIGNATURE.every(
      (expected, index) => leadingBytes[index] === expected,
    );
  }

  return false;
}

export function sanitizeReceiptFilename(filename: string): string {
  const basename = filename.split(/[\\/]/u).at(-1) ?? "";
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/[";]/gu, "")
    .trim()
    .slice(0, 255);
  return cleaned || "receipt";
}

export function contentDispositionForReceipt(
  filename: string,
  disposition: "attachment" | "inline" = "attachment",
): string {
  const safe = sanitizeReceiptFilename(filename);
  const fallback =
    safe
      .normalize("NFKD")
      .replace(/[^\u0020-\u007e]/gu, "_")
      .replaceAll("\\", "_") || "receipt";
  const encoded = encodeURIComponent(safe).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
