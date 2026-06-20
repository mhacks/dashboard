import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { retryFailedRecipients } from "@/lib/email/campaigns/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { campaignId } = await params;
    const status = await retryFailedRecipients(campaignId);

    return campaignJson(status);
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
