import type { RsvpStatus } from "@/lib/rsvp/status";
import type { RsvpFormData } from "@/lib/types/rsvps";

export type AdminRsvpSummary = {
  applicationId: string;
  applicationSlug: string;
  applicationName: string;
  accountEmail: string;
  status: RsvpStatus;
  submittedAt: string | null;
  travelPlan: RsvpFormData["travelPlan"] | null;
  tshirtSize: RsvpFormData["tshirtSize"] | null;
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
