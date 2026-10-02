import { z } from "zod";
import {
  MAX_RESERVATION_TABLE_COUNT,
  MAX_RESERVATION_TABLE_NUMBER,
} from "./domain";

const nullableDate = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.coerce.date().nullable(),
);

export const reservationIdSchema = z.uuid();
export const reservationTableNumberSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(MAX_RESERVATION_TABLE_NUMBER);
export const reservationTableCountSchema = z.coerce
  .number()
  .int()
  .nonnegative()
  .max(MAX_RESERVATION_TABLE_COUNT);
export const reservationTableTopologyEntrySchema = z.object({
  id: reservationIdSchema,
  number: reservationTableNumberSchema,
  reservedByTeamId: reservationIdSchema.nullable(),
});
export const reservationTableTopologySchema = z.array(
  reservationTableTopologyEntrySchema,
);
export const reservationEventInputSchema = z
  .object({
    reservationsOpenAt: nullableDate,
    reservationsCloseAt: nullableDate,
  })
  .superRefine((value, context) => {
    if (
      value.reservationsOpenAt &&
      value.reservationsCloseAt &&
      value.reservationsCloseAt <= value.reservationsOpenAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["reservationsCloseAt"],
        message: "Closing time must be after opening time.",
      });
    }
  });

export type ReservationEventInput = z.input<typeof reservationEventInputSchema>;
export type ReservationTableTopology = z.infer<
  typeof reservationTableTopologySchema
>;
