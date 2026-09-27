import { drizzleRateLimiter, rateLimitMessage } from "@/lib/rate-limit/drizzle";

const receiptUploadLimiter = drizzleRateLimiter("rsvp:receipt_upload", 10);

const RECEIPT_UPLOAD_RATE_LIMIT_MESSAGE =
  "Too many receipt uploads. Please wait and try again.";

export async function rsvpReceiptUploadRateLimitMessage(
  userId: string,
): Promise<string | null> {
  return rateLimitMessage(
    receiptUploadLimiter,
    userId,
    RECEIPT_UPLOAD_RATE_LIMIT_MESSAGE,
  );
}
