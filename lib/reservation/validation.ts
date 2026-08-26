import { z } from "zod";
import {
  MAX_RESERVATION_TABLE_COUNT,
  MAX_RESERVATION_TABLE_NUMBER,
  RESERVATION_EVENT_STATUSES,
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
export const reservationEventStatusSchema = z.enum(RESERVATION_EVENT_STATUSES);
export const reservationEditableEventStatusSchema = z.enum([
  "draft",
  "open",
  "closed",
]);

export const reservationEventInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z
      .string()
      .trim()
      .max(2_000)
      .transform((value) => value || null),
    location: z
      .string()
      .trim()
      .max(200)
      .transform((value) => value || null),
    startsAt: nullableDate,
    status: reservationEditableEventStatusSchema,
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
