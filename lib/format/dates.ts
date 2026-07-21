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

export function formatMonthDay(value: Date | string) {
  return coerceDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatShortDateTime(value: Date | string) {
  return coerceDate(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTimelineTimestamp(value: Date | string) {
  const date = coerceDate(value);
  return {
    date: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}
