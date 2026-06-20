import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { sendTestCampaignEmails } from "@/lib/email/campaigns/service";
import { testSendSchema } from "@/lib/email/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { campaignId } = await params;
    const body = testSendSchema.parse(await request.json());
    const results = await sendTestCampaignEmails(campaignId, body.emails);

    return campaignJson({ results });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
