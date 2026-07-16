import { NextRequest } from "next/server";
import { assertEmailRequestAllowed } from "@/lib/email/request-guard";
import {
  campaignErrorResponse,
  campaignJson,
} from "@/lib/email/campaigns/http";
import { sendOneDirectEmail } from "@/lib/email/campaigns/direct-service";

export async function POST(request: NextRequest) {
  try {
    await assertEmailRequestAllowed(request);
    const result = await sendOneDirectEmail(await request.json());

    if (result.status === "failed") {
      return campaignJson(
        { result, error: result.error ?? "Email failed to send" },
        { status: 502 },
      );
    }

    return campaignJson({ result });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
