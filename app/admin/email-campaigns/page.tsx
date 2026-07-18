import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { getCampaignLimits } from "@/lib/email/campaigns/config";
import { listCampaigns } from "@/lib/email/campaigns/service";
import { defaultEmailTheme } from "@/lib/email/theme";
import {
  getActiveTheme,
  getSeedMasterTemplates,
  listMasterTemplates,
} from "@/lib/email/templates/master-service";
import EmailCampaignsClient, {
  type EmailCampaignSurface,
} from "./campaigns-client";

export default async function EmailCampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[] }>;
}) {
  const params = await searchParams;
  const activeView = parseEmailCampaignView(params?.view);
  const { templates, theme, campaigns } = await loadInitialEmailWorkspace();

  return (
    <AdminPageShell width="full">
      <EmailCampaignsClient
        initialSurface={activeView}
        initialTemplates={templates}
        initialTheme={theme}
        initialCampaigns={campaigns}
        initialCampaignLimits={getCampaignLimits()}
      />
    </AdminPageShell>
  );
}

function parseEmailCampaignView(
  value: string | string[] | undefined,
): EmailCampaignSurface {
  const view = Array.isArray(value) ? value[0] : value;

  if (view === "styles" || view === "send") {
    return view;
  }

  return "builder";
}

async function loadInitialEmailWorkspace() {
  const [templateResult, themeResult, campaignResult] =
    await Promise.allSettled([
      listMasterTemplates(),
      getActiveTheme(),
      listCampaigns(),
    ]);

  for (const result of [templateResult, themeResult, campaignResult]) {
    if (result.status === "rejected" && isAuthGateError(result.reason)) {
      throw result.reason;
    }
  }

  return {
    templates:
      templateResult.status === "fulfilled"
        ? templateResult.value.templates
        : getSeedMasterTemplates(),
    theme:
      themeResult.status === "fulfilled"
        ? themeResult.value.theme
        : defaultEmailTheme,
    campaigns:
      campaignResult.status === "fulfilled" ? campaignResult.value : [],
  };
}

function isAuthGateError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === "Unauthorized" || error.message === "Forbidden")
  );
}
