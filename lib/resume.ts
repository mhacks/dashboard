const RESUME_KEY_PATTERN =
  /^resumes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

export function isAllowedResumeKey(key: string) {
  return RESUME_KEY_PATTERN.test(key);
}

export function resumeKeyForUser(userId: string) {
  return `resumes/${userId}.pdf`;
}

export function isPdfBuffer(buffer: Buffer) {
  return (
    buffer.length >= 4 && buffer.subarray(0, 4).toString("utf8") === "%PDF"
  );
}
