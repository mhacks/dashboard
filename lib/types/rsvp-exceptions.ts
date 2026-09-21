import { z } from "zod";
import type { ApplicationDecision } from "@/lib/decisions";

export const RSVP_EXCEPTION_MAX_DURATION_HOURS = 24 * 30;

export const createRsvpExceptionSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  durationHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(RSVP_EXCEPTION_MAX_DURATION_HOURS),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null),
});

export const revokeRsvpExceptionSchema = z.strictObject({
  id: z.uuid(),
});

export type RsvpExceptionStatus = "active" | "expired" | "revoked";

export type AdminRsvpException = {
  id: string;
  userId: string;
  applicationId: string;
  applicationName: string;
  accountEmail: string;
  applicationDecision: ApplicationDecision;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  status: RsvpExceptionStatus;
  createdByEmail: string | null;
};

export type CreateRsvpExceptionResult =
  | {
      ok: true;
      exception: AdminRsvpException;
    }
  | {
      ok: false;
      message: string;
    };

export type RevokeRsvpExceptionResult =
  | {
      ok: true;
      id: string;
    }
  | {
      ok: false;
      message: string;
    };

export function rsvpExceptionStatus({
  expiresAt,
  revokedAt,
}: Pick<AdminRsvpException, "expiresAt" | "revokedAt">): RsvpExceptionStatus {
  if (revokedAt) return "revoked";
  return Date.parse(expiresAt) > Date.now() ? "active" : "expired";
}
