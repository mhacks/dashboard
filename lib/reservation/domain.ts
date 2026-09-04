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

type ReservationWindow = {
  status: ReservationEventStatus;
  reservationsOpenAt?: Date | string | null;
  reservationsCloseAt?: Date | string | null;
};

export type ReservationAvailability =
  | { state: "hidden"; canReserve: false }
  | { state: "scheduled"; canReserve: false; boundary: Date }
  | { state: "closed"; canReserve: false }
  | { state: "open"; canReserve: true };

export function getReservationAvailability(
  event: ReservationWindow,
  now: Date = new Date(),
): ReservationAvailability {
  if (event.status === "draft" || event.status === "archived") {
    return { state: "hidden", canReserve: false };
  }
  if (event.status === "closed") {
    return { state: "closed", canReserve: false };
  }

  const opensAt = event.reservationsOpenAt
    ? new Date(event.reservationsOpenAt)
    : null;
  const closesAt = event.reservationsCloseAt
    ? new Date(event.reservationsCloseAt)
    : null;

  if (opensAt && now < opensAt) {
    return { state: "scheduled", canReserve: false, boundary: opensAt };
  }
  if (closesAt && now >= closesAt) {
    return { state: "closed", canReserve: false };
  }
  return { state: "open", canReserve: true };
}

type TableSlot = {
  id: string;
  number: number;
  reservedByTeamId: string | null;
};

export type TableCountPlan =
  | { ok: true; addNumbers: number[]; removeIds: string[] }
  | { ok: false; blockedNumbers: number[] };

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
  const blockedNumbers = targets
    .filter((table) => table.reservedByTeamId)
    .map((table) => table.number)
    .sort((left, right) => left - right);

  return blockedNumbers.length > 0
    ? { ok: false, blockedNumbers }
    : { ok: true, addNumbers: [], removeIds: targets.map((table) => table.id) };
}
