import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import { assertCampaignsEnabled } from "@/lib/email/campaigns/config";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { renderCampaignEmail } from "@/lib/email/render";
import { campaignUpsertSchema } from "@/lib/email/types";

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    assertCampaignsEnabled();
    const body = campaignUpsertSchema.parse(await request.json());
    const rendered = await renderCampaignEmail({
      templateId: body.templateId,
      subject: body.subject,
      previewText: body.previewText,
      content: body.content,
      mergeData: {
        email: "hacker@mhacks.org",
        name: "Hacker",
        travel_reimbursement: "150.00",
      },
    });

    return campaignJson(rendered);
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
