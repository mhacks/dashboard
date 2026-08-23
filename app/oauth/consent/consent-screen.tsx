"use client";

import Image from "next/image";
import { useTransition } from "react";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  approveAuthorization,
  denyAuthorization,
} from "@/lib/actions/oauth-consent.server.actions";

// Matches Supabase's `OAuthAuthorizationDetails` shape
// (packages/core/auth-js/src/lib/types.ts) structurally, without importing
// it directly.
interface ConsentDetails {
  client: { name: string };
  user: { email: string };
  scope: string;
  // The client's registered callback — unlike `client.name` (free text set
  // at registration, not shown-and-validated anywhere else) this is the
  // actual destination the auth code is delivered to, so it's what a user
  // should check if a client's name looks impersonated.
  redirect_uri: string;
}

// `details.scope` is whatever OAuth scope string the connecting client chose
// to request (e.g. a client could request just "openid email" to look
// low-risk) — but lib/mcp/auth.ts grants every verified token the same fixed
// MCP_SCOPES (["application:write"]) regardless of what was requested, so
// the raw scope string does not reflect what the client can actually do.
// Showing it as-is would let a client understate its own access on this
// screen. Instead, show the real, fixed capability set every approved
// connection gets — this list must stay in sync with the tools registered
// in app/mcp/route.ts.
const GRANTED_CAPABILITIES = [
  "See your MHacks identity (user ID and email)",
  "View your application status and draft, if any",
  "Save and edit your draft application",
  "Submit your MHacks application on your behalf — this is final and cannot be undone from the app",
  "Request a link to upload a resume to your account",
];

export function ConsentScreen({
  authorizationId,
  details,
}: {
  authorizationId: string;
  details: ConsentDetails;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <Image
        src="/mhacks_blue_auth_bg.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
      />
      {/* Soft wash so the card lifts off the busy photo without hiding it. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25"
      />
      <Card className="relative z-10 w-full max-w-sm bg-[#faf9f4]/95 border-[#c8d4a8] shadow-[0_24px_64px_-24px_rgba(31,42,22,0.55)] backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center pb-2">
          <MHacksLogo size={48} variant="green" />
          <h1
            className="mt-2 font-heading italic text-4xl tracking-tight text-center"
            style={{ color: "#3A4A26" }}
          >
            Authorize access
          </h1>
          <p
            className="mt-2 font-red-hat text-[13px] text-center"
            style={{ color: "rgba(58,74,38,0.6)" }}
          >
            <span className="font-medium" style={{ color: "#3A4A26" }}>
              {details.client.name}
            </span>{" "}
            wants to access your MHacks account as{" "}
            <span className="font-medium">{details.user.email}</span>.
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div>
            <p
              className="font-red-hat text-[11px] uppercase tracking-wide mb-1"
              style={{ color: "rgba(58,74,38,0.55)" }}
            >
              This app will be able to
            </p>
            <ul
              className="font-red-hat text-[13px] list-disc pl-5 flex flex-col gap-1"
              style={{ color: "rgba(58,74,38,0.8)" }}
            >
              {GRANTED_CAPABILITIES.map((capability) => (
                <li key={capability}>{capability}</li>
              ))}
            </ul>
            <p
              className="font-red-hat text-[11px] mt-2"
              style={{ color: "rgba(58,74,38,0.55)" }}
            >
              Every app you approve gets this same full access — MHacks
              doesn&apos;t currently support granting a narrower set of
              permissions.
            </p>
          </div>

          <div
            className="rounded-md border px-3 py-2"
            style={{ borderColor: "#c8d4a8" }}
          >
            <p
              className="font-red-hat text-[11px] uppercase tracking-wide"
              style={{ color: "rgba(58,74,38,0.55)" }}
            >
              You&apos;ll be redirected to
            </p>
            <p
              className="font-mono text-[12px] break-all"
              style={{ color: "#3A4A26" }}
            >
              {details.redirect_uri}
            </p>
          </div>

          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(() => approveAuthorization(authorizationId))
            }
            className="h-11 rounded-full font-red-hat text-[14px] font-medium cursor-pointer"
            style={{ background: "#3A4A26", color: "#fff" }}
          >
            {isPending ? "Working…" : "Approve"}
          </Button>
          <Button
            type="button"
            variant="link"
            disabled={isPending}
            onClick={() =>
              startTransition(() => denyAuthorization(authorizationId))
            }
            className="font-red-hat text-[13px]"
            style={{ color: "rgba(58,74,38,0.55)" }}
          >
            Deny
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
