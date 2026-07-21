export type StatusBadgeVariant = "success" | "warning" | "neutral" | "info";

export type InviteStatusLabel = "Accepted" | "Pending" | "Revoked" | "Expired";

type ApplicationStatus = "pending" | "reviewed" | "flagged";

const INVITE_STATUS_VARIANT: Record<InviteStatusLabel, StatusBadgeVariant> = {
  Accepted: "success",
  Pending: "info",
  Revoked: "neutral",
  Expired: "warning",
};

export function statusBadgeVariantClass(variant: StatusBadgeVariant) {
  switch (variant) {
    case "success":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/50 dark:text-green-300";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300";
    case "neutral":
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
  }
}

export function inviteStatusBadgeClass(status: InviteStatusLabel) {
  return statusBadgeVariantClass(INVITE_STATUS_VARIANT[status]);
}

export function applicationStatusBadgeClass(status: ApplicationStatus) {
  if (status === "reviewed") return statusBadgeVariantClass("success");
  if (status === "flagged") return statusBadgeVariantClass("warning");
  return statusBadgeVariantClass("neutral");
}

export function reviewEventTypeBadgeClass(
  eventType: "review_completed" | "draft_saved",
) {
  if (eventType === "review_completed") {
    return statusBadgeVariantClass("success");
  }
  return statusBadgeVariantClass("neutral");
}
