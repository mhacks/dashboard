import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import {
  createMasterTemplate,
  getActiveTheme,
  listMasterTemplates,
} from "@/lib/email/templates/master-service";

export async function GET(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const [{ templates, databaseReady }, { theme }] = await Promise.all([
      listMasterTemplates(),
      getActiveTheme(),
    ]);

    return campaignJson({ templates, theme, databaseReady });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const template = await createMasterTemplate(await request.json());

    return campaignJson({ template }, { status: 201 });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
