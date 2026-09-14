export function isUniqueViolation(error: unknown) {
  const wrapped = error as { code?: string; cause?: { code?: string } };
  return (wrapped.code ?? wrapped.cause?.code) === "23505";
}
