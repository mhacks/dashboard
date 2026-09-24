export function postgresErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return postgresErrorCode(error.cause);
  return null;
}

export function isUniqueViolation(error: unknown) {
  return postgresErrorCode(error) === "23505";
}
