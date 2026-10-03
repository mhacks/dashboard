import { z } from "zod";
import {
  MAX_MAP_DIMENSION,
  MAX_RESERVATION_TABLE_COUNT,
  MAX_RESERVATION_TABLE_NUMBER,
  MIN_MAP_DIMENSION,
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
export const reservationMapDimensionSchema = z.coerce
  .number()
  .int()
  .min(MIN_MAP_DIMENSION)
  .max(MAX_MAP_DIMENSION);
const MAP_BOUNDS_MESSAGE = "Keep the table inside the 40 by 40 map.";

export const reservationTableOriginSchema = z
  .number()
  .int()
  .nonnegative()
  .max(MAX_MAP_DIMENSION - 1, { message: MAP_BOUNDS_MESSAGE });
export const reservationTableSpanSchema = z
  .number()
  .int()
  .positive()
  .max(MAX_MAP_DIMENSION, { message: MAP_BOUNDS_MESSAGE });
export const reservationTableGeometrySchema = z
  .object({
    tableId: reservationIdSchema,
    originX: reservationTableOriginSchema,
    originY: reservationTableOriginSchema,
    width: reservationTableSpanSchema,
    height: reservationTableSpanSchema,
  })
  .superRefine((value, context) => {
    if (value.originX + value.width > MAX_MAP_DIMENSION) {
      context.addIssue({
        code: "custom",
        path: ["width"],
        message: MAP_BOUNDS_MESSAGE,
      });
    }
    if (value.originY + value.height > MAX_MAP_DIMENSION) {
      context.addIssue({
        code: "custom",
        path: ["height"],
        message: MAP_BOUNDS_MESSAGE,
      });
    }
  });
export const reservationTableGeometriesSchema = z.object({
  tables: z
    .array(reservationTableGeometrySchema)
    .min(1)
    .max(MAX_RESERVATION_TABLE_COUNT),
});
export const reservationMapSizeSchema = z.object({
  columns: reservationMapDimensionSchema,
  rows: reservationMapDimensionSchema,
});
export const windowInputSchema = z
  .object({
    opensAt: nullableDate,
    closesAt: nullableDate,
  })
  .superRefine((value, context) => {
    if (value.opensAt && value.closesAt && value.closesAt <= value.opensAt) {
      context.addIssue({
        code: "custom",
        path: ["closesAt"],
        message: "Closing time must be after opening time.",
      });
    }
  });

export type WindowInput = z.input<typeof windowInputSchema>;
export type ReservationTableTopology = z.infer<
  typeof reservationTableTopologySchema
>;
