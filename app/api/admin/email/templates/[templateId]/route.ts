import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import {
  deleteMasterTemplate,
  updateMasterTemplate,
} from "@/lib/email/templates/master-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { templateId } = await params;
    const template = await updateMasterTemplate(
      templateId,
      await request.json(),
    );

    return campaignJson({ template });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    await assertEmailRequestAllowed(request);
    const { templateId } = await params;
    await deleteMasterTemplate(templateId);

    return campaignJson({ success: true });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
