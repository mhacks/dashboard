import { describe, expect, it } from "vitest";
import {
  MAX_RESERVATION_TABLE_COUNT,
  MAX_RESERVATION_TABLE_NUMBER,
  getReservationAvailability,
  planTableCountChange,
} from "./domain";

describe("getReservationAvailability", () => {
  const now = new Date("2026-10-04T12:00:00Z");

  it.each(["draft", "archived"] as const)("hides %s events", (status) => {
    expect(getReservationAvailability({ status }, now)).toEqual({
      state: "hidden",
      canReserve: false,
    });
  });

  it("schedules an open event before its opening time", () => {
    expect(
      getReservationAvailability(
        { status: "open", reservationsOpenAt: "2026-10-04T13:00:00Z" },
        now,
      ),
    ).toEqual({
      state: "scheduled",
      canReserve: false,
      boundary: new Date("2026-10-04T13:00:00Z"),
    });
  });

  it("opens an in-window event", () => {
    expect(
      getReservationAvailability(
        {
          status: "open",
          reservationsOpenAt: "2026-10-04T11:00:00Z",
          reservationsCloseAt: "2026-10-04T13:00:00Z",
        },
        now,
      ),
    ).toEqual({ state: "open", canReserve: true });
  });

  it("closes an event at its closing boundary", () => {
    expect(
      getReservationAvailability(
        { status: "open", reservationsCloseAt: "2026-10-04T12:00:00Z" },
        now,
      ),
    ).toEqual({ state: "closed", canReserve: false });
  });
});

describe("planTableCountChange", () => {
  const tables = [
    { id: "one", number: 1, reservedByTeamId: null },
    { id: "two", number: 2, reservedByTeamId: null },
  ];

  it("appends sequential numbers when growing", () => {
    expect(planTableCountChange(tables, 4)).toEqual({
      ok: true,
      addNumbers: [3, 4],
      removeIds: [],
    });
  });

  it("removes the highest-numbered slots when shrinking", () => {
    expect(planTableCountChange(tables, 1)).toEqual({
      ok: true,
      addNumbers: [],
      removeIds: ["two"],
    });
  });

  it("blocks a shrink when a targeted slot is assigned", () => {
    expect(
      planTableCountChange(
        [tables[0], { id: "two", number: 2, reservedByTeamId: "team-id" }],
        1,
      ),
    ).toEqual({ ok: false, blockedNumbers: [2] });
  });

  it("rejects an excessive desired count before allocating", () => {
    expect(MAX_RESERVATION_TABLE_COUNT).toBe(500);
    expect(() =>
      planTableCountChange([], Number.MAX_SAFE_INTEGER),
    ).toThrowError("desired table count must not exceed 500");
  });

  it("rejects growth beyond PostgreSQL's integer table-number limit", () => {
    expect(MAX_RESERVATION_TABLE_NUMBER).toBe(2_147_483_647);
    expect(() =>
      planTableCountChange(
        [
          {
            id: "last",
            number: 2_147_483_647,
            reservedByTeamId: null,
          },
        ],
        2,
      ),
    ).toThrowError("table numbers must not exceed 2147483647");
  });
});
