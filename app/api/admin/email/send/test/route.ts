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

    const firstFailure = results.find((result) => result.status === "failed");
    const sentCount = results.filter(
      (result) => result.status === "sent",
    ).length;

    if (firstFailure && sentCount === 0) {
      return campaignJson(
        { results, error: firstFailure.error ?? "Test email failed to send" },
        { status: 502 },
      );
    }

    return campaignJson({ results });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}
