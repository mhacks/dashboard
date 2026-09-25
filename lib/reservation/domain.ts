export const RESERVATION_EVENT_STATUSES = [
  "draft",
  "open",
  "closed",
  "archived",
] as const;

export const MAX_RESERVATION_TABLE_COUNT = 500;
export const MAX_RESERVATION_TABLE_NUMBER = 2_147_483_647;

export type ReservationEventStatus =
  (typeof RESERVATION_EVENT_STATUSES)[number];

export const RESERVATION_EVENT_STATUS_LABELS: Record<
  ReservationEventStatus,
  string
> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  archived: "Archived",
};

export const RESERVATION_EVENT_STATUS_BADGE_VARIANTS: Record<
  ReservationEventStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  open: "default",
  closed: "secondary",
  archived: "destructive",
};

type ReservationWindow = {
  status: ReservationEventStatus;
  reservationsOpenAt?: Date | string | null;
  reservationsCloseAt?: Date | string | null;
};

export type ReservationAvailability =
  | { state: "hidden" }
  | { state: "scheduled"; boundary: Date }
  | { state: "closed" }
  | { state: "open" };

export function getReservationAvailability(
  event: ReservationWindow,
  now: Date = new Date(),
): ReservationAvailability {
  if (event.status === "draft" || event.status === "archived") {
    return { state: "hidden" };
  }
  if (event.status === "closed") {
    return { state: "closed" };
  }

  const opensAt = event.reservationsOpenAt
    ? new Date(event.reservationsOpenAt)
    : null;
  const closesAt = event.reservationsCloseAt
    ? new Date(event.reservationsCloseAt)
    : null;

  if (opensAt && now < opensAt) {
    return { state: "scheduled", boundary: opensAt };
  }
  if (closesAt && now >= closesAt) {
    return { state: "closed" };
  }
  return { state: "open" };
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
