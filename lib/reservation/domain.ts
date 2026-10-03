export const MAX_RESERVATION_TABLE_COUNT = 500;
export const MAX_RESERVATION_TABLE_NUMBER = 2_147_483_647;

export type TimedWindow = {
  opensAt?: Date | string | null;
  closesAt?: Date | string | null;
};

export type WindowState = "scheduled" | "open" | "closed";

export type WindowAvailability = {
  state: WindowState;
  opensAt: Date | null;
  closesAt: Date | null;
};

type ReservationWindow = {
  reservationsOpenAt?: Date | string | null;
  reservationsCloseAt?: Date | string | null;
};

function parseWindowInstant(
  value: Date | string | null | undefined,
): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isMissingWindowInstant(
  value: Date | string | null | undefined,
): boolean {
  return value == null || value === "";
}

/**
 * Open while `now` is in `[opensAt, closesAt)`. No open time, an unparseable
 * close time, or a close at or before the open time is closed. A missing close
 * time stays open after the open time. Before the open time is scheduled.
 */
export function getWindowAvailability(
  window: TimedWindow,
  now: Date = new Date(),
): WindowAvailability {
  const opensAt = parseWindowInstant(window.opensAt);
  const closesAt = parseWindowInstant(window.closesAt);
  const closeMissing = isMissingWindowInstant(window.closesAt);

  if (
    !opensAt ||
    (!closeMissing && !closesAt) ||
    (closesAt !== null && closesAt <= opensAt)
  ) {
    return { state: "closed", opensAt, closesAt };
  }
  if (now < opensAt) {
    return { state: "scheduled", opensAt, closesAt };
  }
  if (closesAt !== null && now >= closesAt) {
    return { state: "closed", opensAt, closesAt };
  }
  return { state: "open", opensAt, closesAt };
}

export function getReservationAvailability(
  event: ReservationWindow,
  now: Date = new Date(),
): WindowAvailability {
  return getWindowAvailability(
    {
      opensAt: event.reservationsOpenAt,
      closesAt: event.reservationsCloseAt,
    },
    now,
  );
}

export function formatWindowInstant(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Detroit",
    timeZoneName: "short",
  }).format(date);
}

/** Scheduled, Open, or Locked, plus the boundary a hacker needs to see. */
export function describeWindow(
  availability: WindowAvailability,
  now: Date = new Date(),
): string {
  if (availability.state === "scheduled" && availability.opensAt) {
    const opens = formatWindowInstant(availability.opensAt);
    return availability.closesAt
      ? `Scheduled. Opens ${opens}. Closes ${formatWindowInstant(availability.closesAt)}.`
      : `Scheduled. Opens ${opens}.`;
  }
  if (availability.state === "open") {
    return availability.closesAt
      ? `Open. Closes ${formatWindowInstant(availability.closesAt)}.`
      : "Open.";
  }
  if (
    availability.closesAt &&
    availability.closesAt.getTime() <= now.getTime()
  ) {
    return `Locked. Closed ${formatWindowInstant(availability.closesAt)}.`;
  }
  return "Locked.";
}

export function formatReservationList(
  values: readonly (number | string)[],
): string {
  const labels = values.map(String);
  if (labels.length < 2) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

type TableSlot = {
  id: string;
  number: number;
  reservedByTeamId: string | null;
};

export type TableCountPlan =
  | { ok: true; addNumbers: number[]; removeIds: string[] }
  | { ok: false; blockedNumbers: number[]; removeIds: string[] };

export function planTableCountChange(
  current: readonly TableSlot[],
  desiredCount: number,
): TableCountPlan {
  if (!Number.isInteger(desiredCount) || desiredCount < 0) {
    throw new Error("desired table count must be a non-negative integer");
  }
  if (desiredCount > MAX_RESERVATION_TABLE_COUNT) {
    throw new RangeError(
      `desired table count must not exceed ${MAX_RESERVATION_TABLE_COUNT}`,
    );
  }

  if (desiredCount >= current.length) {
    const addCount = desiredCount - current.length;
    const highest = current.reduce(
      (maximum, table) => Math.max(maximum, table.number),
      0,
    );
    if (addCount > 0 && highest > MAX_RESERVATION_TABLE_NUMBER - addCount) {
      throw new RangeError(
        `table numbers must not exceed ${MAX_RESERVATION_TABLE_NUMBER}`,
      );
    }
    return {
      ok: true,
      addNumbers: Array.from(
        { length: addCount },
        (_, index) => highest + index + 1,
      ),
      removeIds: [],
    };
  }

  const removalCount = current.length - desiredCount;
  const targets = [...current]
    .sort((left, right) => right.number - left.number)
    .slice(0, removalCount);
  const removeIds = targets.map((table) => table.id);
  const blockedNumbers = targets
    .filter((table) => table.reservedByTeamId)
    .map((table) => table.number)
    .sort((left, right) => left - right);

  return blockedNumbers.length > 0
    ? { ok: false, blockedNumbers, removeIds }
    : { ok: true, addNumbers: [], removeIds };
}
