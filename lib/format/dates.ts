export function coerceDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function formatShortDate(value: Date | string) {
  return coerceDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
