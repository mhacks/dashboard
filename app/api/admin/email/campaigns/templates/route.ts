import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  assertCampaignsEnabled,
  getCampaignLimits,
} from "@/lib/email/campaigns/config";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { renderCampaignEmail } from "@/lib/email/render";
import { getTemplateCatalog } from "@/lib/email/templates/registry";

export async function GET(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    assertCampaignsEnabled();
    const templates = await Promise.all(
      getTemplateCatalog().map(async (template) => {
        const preview = await renderCampaignEmail({
          templateId: template.id,
          subject: template.defaultSubject,
          previewText: template.defaultPreviewText,
          content: template.defaultContent,
          mergeData: {
            email: "hacker@mhacks.org",
            name: "Hacker",
            travel_reimbursement: "150.00",
          },
        });

        return {
          ...template,
          previewHtml: preview.html,
        };
      }),
    );

    return campaignJson({ templates, limits: getCampaignLimits() });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
