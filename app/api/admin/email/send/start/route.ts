import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { sendDirectBatch } from "@/lib/email/campaigns/direct-service";

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const status = await sendDirectBatch(await request.json());

    return campaignJson(status);
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
