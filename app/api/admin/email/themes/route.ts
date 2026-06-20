import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import {
  getActiveTheme,
  saveActiveTheme,
} from "@/lib/email/templates/master-service";

export async function GET(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    return campaignJson(await getActiveTheme());
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const theme = await saveActiveTheme(await request.json());

    return campaignJson({ theme });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
