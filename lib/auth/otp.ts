/** Must match `auth.email.otp_length` in supabase/config.toml (6–10). */
export const OTP_LENGTH = 8;

export const OTP_GROUP_SIZE = OTP_LENGTH / 2;

const OTP_RAW_PREVIEW_CODE = "12345678".slice(0, OTP_LENGTH);

/** Formats digits as XXXX-XXXX for display (login UI, emails, previews). */
export function formatOtpForDisplay(code: string) {
  const digits = code.replace(/\D/g, "").slice(0, OTP_LENGTH);
  if (digits.length <= OTP_GROUP_SIZE) return digits;
  return `${digits.slice(0, OTP_GROUP_SIZE)}-${digits.slice(OTP_GROUP_SIZE)}`;
}

export const OTP_PREVIEW_CODE = formatOtpForDisplay(OTP_RAW_PREVIEW_CODE);
