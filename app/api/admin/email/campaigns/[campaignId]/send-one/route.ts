import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { sendOneCampaignEmail } from "@/lib/email/campaigns/service";
import { sendOneSchema } from "@/lib/email/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { campaignId } = await params;
    const body = sendOneSchema.parse(await request.json());
    const result = await sendOneCampaignEmail(campaignId, body.email);

    return campaignJson({ result });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
