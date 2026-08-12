export const RSVP_RECEIPT_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export type RsvpReceiptContentType =
  (typeof RSVP_RECEIPT_CONTENT_TYPES)[number];

export const MAX_RSVP_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024;

export function receiptStagingKeyForUser(
  userId: string,
  objectId: string,
): string {
  return `rsvp-receipts/${userId}/staging/${objectId}`;
}

export function receiptConfirmedKeyForUser(
  userId: string,
  objectId: string,
): string {
  return `rsvp-receipts/${userId}/confirmed/${objectId}`;
}

export function rsvpReceiptKeyBelongsToUser(
  key: string,
  userId: string,
): boolean {
  return key.startsWith(`rsvp-receipts/${userId}/`);
}

const SIGNATURES: Record<RsvpReceiptContentType, readonly number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

export function isRsvpReceiptContentType(
  value: string,
): value is RsvpReceiptContentType {
  return RSVP_RECEIPT_CONTENT_TYPES.some((type) => type === value);
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
    throw new Error("Receipt must be a PDF, PNG, or JPEG");
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Receipt cannot be empty");
  }
  if (sizeBytes > MAX_RSVP_RECEIPT_SIZE_BYTES) {
    throw new Error("Receipt exceeds the 10MB limit");
  }

  const signature = SIGNATURES[contentType];
  const matches = signature.every(
    (expected, index) => leadingBytes[index] === expected,
  );
  if (!matches) {
    throw new Error("Receipt signature does not match its file type");
  }
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
