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
    const { results, testSendToken, testSendExpiresAt } =
      await sendDirectTestEmails(await request.json());
    const redactedResults = results.map((result) => ({
      status: result.status,
      messageId: result.messageId,
      error: redactEmailAddresses(result.error),
    }));

    const firstFailure = redactedResults.find(
      (result) => result.status === "failed",
    );
    const sentCount = results.filter(
      (result) => result.status === "sent",
    ).length;

    if (firstFailure && sentCount === 0) {
      return campaignJson(
        {
          results: redactedResults,
          testSendToken,
          testSendExpiresAt,
          error: firstFailure.error ?? "Test email failed to send",
        },
        { status: 502 },
      );
    }

    return campaignJson({
      results: redactedResults,
      testSendToken,
      testSendExpiresAt,
    });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

function redactEmailAddresses(value: string | null) {
  return (
    value?.replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[test recipient]",
    ) ?? null
  );
}
