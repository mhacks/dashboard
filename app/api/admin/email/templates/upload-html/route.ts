import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { uploadHtmlTemplate } from "@/lib/email/templates/master-service";

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const formData = await request.formData();
    const file = formData.get("file");
    const html =
      file instanceof File
        ? await file.text()
        : String(formData.get("html") ?? "");

    const template = await uploadHtmlTemplate({
      name: String(formData.get("name") ?? "Uploaded template"),
      description: String(formData.get("description") ?? ""),
      subject: String(formData.get("subject") ?? "MHacks update"),
      previewText: String(formData.get("previewText") ?? ""),
      html,
    });

    return campaignJson({ template }, { status: 201 });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
