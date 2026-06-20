import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { renderEmailPreview } from "@/lib/email/render";

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const rendered = await renderEmailPreview(await request.json());

    return campaignJson(rendered);
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
