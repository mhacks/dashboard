import { describe, expect, it } from "vitest";
import {
  MAX_RESERVATION_TABLE_COUNT,
  MAX_RESERVATION_TABLE_NUMBER,
} from "./domain";
import {
  reservationEventInputSchema,
  reservationTableCountSchema,
  reservationTableNumberSchema,
} from "./validation";

describe("reservationEventInputSchema", () => {
  it("rejects a closing time before the opening time", () => {
    const result = reservationEventInputSchema.safeParse({
      name: "Final judging",
      description: "",
      location: "",
      startsAt: "",
      status: "open",
      reservationsOpenAt: "2026-10-04T13:00:00Z",
      reservationsCloseAt: "2026-10-04T12:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

it("accepts zero tables but rejects negative counts", () => {
  expect(MAX_RESERVATION_TABLE_COUNT).toBe(500);
  expect(reservationTableCountSchema.safeParse(0).success).toBe(true);
  expect(reservationTableCountSchema.safeParse(-1).success).toBe(false);
  expect(reservationTableCountSchema.safeParse(500).success).toBe(true);
  expect(reservationTableCountSchema.safeParse(501).success).toBe(false);
});

it("requires positive integer table numbers", () => {
  expect(MAX_RESERVATION_TABLE_NUMBER).toBe(2_147_483_647);
  expect(reservationTableNumberSchema.safeParse(1).success).toBe(true);
  expect(reservationTableNumberSchema.safeParse(0).success).toBe(false);
  expect(reservationTableNumberSchema.safeParse(2_147_483_647).success).toBe(
    true,
  );
  expect(reservationTableNumberSchema.safeParse(2_147_483_648).success).toBe(
    false,
  );
});
