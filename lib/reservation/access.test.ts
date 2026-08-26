import { describe, expect, it } from "vitest";
import { isAcceptedReservationDecision } from "./access";

describe("isAcceptedReservationDecision", () => {
  it.each([
    "early_accepted",
    "early_rsvped",
    "regular_accepted",
    "regular_rsvped",
  ] as const)("accepts %s", (decision) => {
    expect(isAcceptedReservationDecision(decision)).toBe(true);
  });

  it.each(["applied", "early_rejected", "regular_rejected"] as const)(
    "rejects %s",
    (decision) => {
      expect(isAcceptedReservationDecision(decision)).toBe(false);
    },
  );
});
