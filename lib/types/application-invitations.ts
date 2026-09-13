import { z } from "zod";

export const APPLICATION_INVITATION_MAX_DURATION_HOURS = 24 * 30;

export const createApplicationInvitationSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  durationHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(APPLICATION_INVITATION_MAX_DURATION_HOURS),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null),
});

export const revokeApplicationInvitationSchema = z.strictObject({
  id: z.uuid(),
});

export type ApplicationInvitationStatus =
  "active" | "applied" | "expired" | "revoked";

export type AdminApplicationInvitation = {
  id: string;
  email: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  createdByEmail: string | null;
  applicationId: string | null;
  applicationName: string | null;
  submittedAt: string | null;
  status: ApplicationInvitationStatus;
};

export type CreateApplicationInvitationResult =
  | {
      ok: true;
      invitation: AdminApplicationInvitation;
      emailSent: boolean;
    }
  | { ok: false; message: string };

export type RevokeApplicationInvitationResult =
  { ok: true; id: string } | { ok: false; message: string };

export function applicationInvitationStatus({
  applicationId,
  expiresAt,
  revokedAt,
}: Pick<
  AdminApplicationInvitation,
  "applicationId" | "expiresAt" | "revokedAt"
>): ApplicationInvitationStatus {
  if (applicationId) return "applied";
  if (revokedAt) return "revoked";
  return Date.parse(expiresAt) > Date.now() ? "active" : "expired";
}
