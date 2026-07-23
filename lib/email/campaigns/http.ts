import { NextResponse } from "next/server";
import { ZodError } from "zod";
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

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid email campaign request", issues: error.issues },
      { status: 400 },
    );
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message === "Forbidden") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: campaignUnexpectedError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { error: "Unexpected email campaign error" },
    { status: 500 },
  );
}

function campaignUnexpectedError(error: Error) {
  const cause = error.cause;

  if (
    error.message.startsWith("Failed query:") &&
    cause instanceof Error &&
    cause.message
  ) {
    return `Database error: ${cause.message}`;
  }

  return error.message;
}
