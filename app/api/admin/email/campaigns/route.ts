import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import { createCampaign } from "@/lib/email/campaigns/service";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { getCampaignLimits } from "@/lib/email/campaigns/config";
import { getTemplateCatalog } from "@/lib/email/templates/registry";

export async function GET(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    return campaignJson({
      campaigns: [],
      templates: getTemplateCatalog(),
      limits: getCampaignLimits(),
      databaseReady: false,
    });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const campaign = await createCampaign(await request.json());

    return campaignJson({ campaign }, { status: 201 });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
