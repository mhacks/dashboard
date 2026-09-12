import type { EmailAudienceQuery } from "@/lib/email/types";
import type { EmailCampaignSurface } from "./surface";
import { FileText, Palette, Send } from "lucide-react";

export type PreviewMode = "desktop" | "mobile";
export type RecipientSource = "manual" | "audience";

export interface CampaignLimits {
  maxRecipients: number;
  batchSize: number;
  sendDelayMs: number;
  maxSendRatePerSecond?: number;
}

export interface RecipientSaveResult {
  emails: string[];
  invalid: string[];
  duplicateCount: number;
  columns?: string[];
}

export interface AudienceResolveResult extends RecipientSaveResult {
  recipientText: string;
  label: string;
}

export interface DirectSendStatus {
  runId: string;
  proofKey?: string;
  interrupted: boolean;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  sendingCount: number;
  leaseActive: boolean;
  leaseExpiresAt: string | null;
  nextCursor: number;
  complete: boolean;
  invalid: string[];
  duplicateCount: number;
  columns?: string[];
  unverifiedRecipients: string[];
  recentFailures: Array<{
    email: string;
    error: string | null;
  }>;
}

export interface TestSendProof {
  token: string;
  expiresAt: string;
  proofKey: string;
  sentCount: number;
  totalCount: number;
}

export interface SendJobFailure {
  email?: string;
  error: string | null;
}

export interface SendJobSnapshot {
  total: number;
  sentCount: number;
  failedCount: number;
  pendingCount?: number;
  sendingCount?: number;
  complete: boolean;
  failures: SendJobFailure[];
}

export const EMAIL_WORKSPACE_PANEL_IDS = [
  "templates-list",
  "campaign-workspace",
  "preview",
] as const;

export const DESKTOP_LAYOUT_QUERY = "(min-width: 1024px)";

export const builtInRecipientMergeFields = new Set(["email", "name"]);

export const defaultAudienceQuery: EmailAudienceQuery = {
  decisionGroup: "all_applicants",
  travelAward: "any",
  rsvpTravelPlan: "any",
};

export const audienceDecisionOptions = [
  ["all_applicants", "All applicants"],
  ["draft", "Draft application (not submitted)"],
  ["umich", "All @umich.edu users"],
  ["accepted", "All accepted"],
  ["rsvped", "All RSVPed"],
  ["rejected", "All rejected"],
  ["early_accepted_or_rsvped", "Early accepted or RSVPed"],
  ["regular_accepted_or_rsvped", "Regular accepted or RSVPed"],
  ["applied", "Applied"],
  ["early_accepted", "Early accepted"],
  ["early_rsvped", "Early RSVPed"],
  ["early_rejected", "Early rejected"],
  ["regular_accepted", "Regular accepted"],
  ["regular_rsvped", "Regular RSVPed"],
  ["regular_rejected", "Regular rejected"],
] satisfies Array<[EmailAudienceQuery["decisionGroup"], string]>;

export const audienceTravelAwardOptions = [
  ["any", "Any travel award"],
  ["approved", "Approved travel reimbursement"],
  ["none", "No approved travel reimbursement"],
] satisfies Array<[EmailAudienceQuery["travelAward"], string]>;

export const audienceRsvpTravelPlanOptions = [
  ["any", "Any RSVP travel plan"],
  ["local", "Local"],
  ["self-funded", "Self-funded"],
  ["reimbursement", "Reimbursement"],
] satisfies Array<[EmailAudienceQuery["rsvpTravelPlan"], string]>;

export const emailCampaignViews: Array<{
  value: EmailCampaignSurface;
  label: string;
  icon: typeof FileText;
}> = [
  { value: "builder", label: "Builder", icon: FileText },
  { value: "styles", label: "Styles", icon: Palette },
  { value: "send", label: "Send", icon: Send },
];
