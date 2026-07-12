"use client";

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

export function ConsentScreen({
  authorizationId,
  details,
}: {
  authorizationId: string;
  details: ConsentDetails;
}) {
  const [isPending, startTransition] = useTransition();
  const scopes = details.scope.split(" ").filter(Boolean);

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <Card className="relative z-10 w-full max-w-sm bg-[#faf9f4] border-[#c8d4a8]">
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
          <ul
            className="font-red-hat text-[13px] list-disc pl-5"
            style={{ color: "rgba(58,74,38,0.8)" }}
          >
            {scopes.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>

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
