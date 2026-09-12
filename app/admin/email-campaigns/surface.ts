export type EmailCampaignSurface = "builder" | "styles" | "send";

export function parseEmailCampaignView(
  value: string | string[] | null | undefined,
): EmailCampaignSurface {
  const view = Array.isArray(value) ? value[0] : value;

  if (view === "styles" || view === "send") {
    return view;
  }

  return "builder";
}
