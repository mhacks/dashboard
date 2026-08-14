export const RSVP_RECEIPT_CONTENT_TYPE = "application/pdf";
export const RSVP_RECEIPT_CONTENT_TYPES = [
  RSVP_RECEIPT_CONTENT_TYPE,
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type RsvpReceiptContentType =
  (typeof RSVP_RECEIPT_CONTENT_TYPES)[number];

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
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

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
    throw new Error("Receipt must be a PDF or image");
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Receipt cannot be empty");
  }
  if (sizeBytes > MAX_RSVP_RECEIPT_SIZE_BYTES) {
    throw new Error("Receipt exceeds the 20MB limit");
  }

  if (!receiptSignatureMatches(contentType, leadingBytes)) {
    throw new Error("Receipt must be a valid PDF or image");
  }
}

function receiptSignatureMatches(
  contentType: RsvpReceiptContentType,
  leadingBytes: Uint8Array,
): boolean {
  if (contentType === "application/pdf") {
    return PDF_SIGNATURE.every(
      (expected, index) => leadingBytes[index] === expected,
    );
  }
  if (contentType === "image/jpeg") {
    return JPEG_SIGNATURE.every(
      (expected, index) => leadingBytes[index] === expected,
    );
  }
  if (contentType === "image/png") {
    return PNG_SIGNATURE.every(
      (expected, index) => leadingBytes[index] === expected,
    );
  }
  if (contentType === "image/webp") {
    return (
      leadingBytes[0] === 0x52 &&
      leadingBytes[1] === 0x49 &&
      leadingBytes[2] === 0x46 &&
      leadingBytes[3] === 0x46 &&
      leadingBytes[8] === 0x57 &&
      leadingBytes[9] === 0x45 &&
      leadingBytes[10] === 0x42 &&
      leadingBytes[11] === 0x50
    );
  }

  const brand = new TextDecoder("ascii")
    .decode(leadingBytes.slice(4, 12))
    .toLowerCase();
  return (
    brand.startsWith("ftypheic") ||
    brand.startsWith("ftypheix") ||
    brand.startsWith("ftyphevc") ||
    brand.startsWith("ftyphevx") ||
    brand.startsWith("ftypheif") ||
    brand.startsWith("ftypmif1") ||
    brand.startsWith("ftypmsf1")
  );
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
