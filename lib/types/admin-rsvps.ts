import type { RsvpStatus } from "@/lib/rsvp/status";
import type { RsvpFormData, RsvpReceiptMetadata } from "@/lib/types/rsvps";

export type AdminRsvpAward = {
  regionLabel: string;
  amountCents: number;
};

export type AdminRsvpSummary = {
  applicationId: string;
  applicationSlug: string;
  applicationName: string;
  accountEmail: string;
  status: RsvpStatus;
  submittedAt: string | null;
  travelPlan: RsvpFormData["travelPlan"] | null;
  tshirtSize: RsvpFormData["tshirtSize"] | null;
  award: AdminRsvpAward | null;
  receipt: RsvpReceiptMetadata | null;
};

export type AdminRsvpCounts = Record<"all" | RsvpStatus, number>;

export type AdminRsvpDashboard = {
  rows: AdminRsvpSummary[];
  counts: AdminRsvpCounts;
};

export type AdminRsvpDetail = {
  summary: AdminRsvpSummary;
  values: RsvpFormData | null;
};
