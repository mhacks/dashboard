import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  deleteCampaign,
  getCampaignDetails,
  updateCampaign,
} from "@/lib/email/campaigns/service";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { campaignId } = await params;
    const details = await getCampaignDetails(campaignId);

    return campaignJson(details);
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { campaignId } = await params;
    const campaign = await updateCampaign(campaignId, await request.json());

    return campaignJson({ campaign });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { campaignId } = await params;
    await deleteCampaign(campaignId);

    return campaignJson({ success: true });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
