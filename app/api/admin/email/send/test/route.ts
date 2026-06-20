import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { sendDirectTestEmails } from "@/lib/email/campaigns/direct-service";

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const results = await sendDirectTestEmails(await request.json());

    return campaignJson({ results });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
