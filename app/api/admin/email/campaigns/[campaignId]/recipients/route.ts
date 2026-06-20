import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { saveCampaignRecipients } from "@/lib/email/campaigns/service";
import { recipientTextSchema } from "@/lib/email/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { campaignId } = await params;
    const body = recipientTextSchema.parse(await request.json());
    const parsed = await saveCampaignRecipients(campaignId, body.recipients);

    return campaignJson(parsed);
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
