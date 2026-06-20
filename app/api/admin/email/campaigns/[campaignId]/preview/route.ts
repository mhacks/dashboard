import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { renderCampaignPreview } from "@/lib/email/campaigns/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { campaignId } = await params;
    const body = await request.json().catch(() => ({}));
    const rendered = await renderCampaignPreview(campaignId, body);

    return campaignJson(rendered);
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
