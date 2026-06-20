import { NextResponse } from "next/server";
import { EmailCampaignError } from "@/lib/email/campaigns/config";

export function campaignJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function campaignErrorResponse(error: unknown) {
  if (error instanceof EmailCampaignError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { error: "Unexpected email campaign error" },
    { status: 500 },
  );
}
