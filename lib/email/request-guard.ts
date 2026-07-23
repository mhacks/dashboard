import { type NextRequest } from "next/server";
import { requireOrganizer } from "@/lib/auth/guards";
import { EmailCampaignError } from "@/lib/email/campaigns/config";

export async function assertEmailRequestAllowed(request?: NextRequest) {
  const organizer = await requireOrganizer();

  if (request) {
    assertSameOriginMutation(request);
  }

  return organizer;
}

function assertSameOriginMutation(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!host) {
    throw new EmailCampaignError("Unable to verify request origin", 403);
  }

  try {
    if (new URL(origin).host === host) {
      return;
    }
  } catch {
    throw new EmailCampaignError("Invalid request origin", 403);
  }

  throw new EmailCampaignError("Cross-origin email admin request blocked", 403);
}
