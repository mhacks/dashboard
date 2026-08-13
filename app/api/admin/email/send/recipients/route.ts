import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { parseDirectRecipients } from "@/lib/email/campaigns/direct-service";

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const parsed = parseDirectRecipients(await request.json());

    return campaignJson(parsed);
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
