"use client";

import { useState, useTransition } from "react";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { revokeGrant } from "@/lib/actions/oauth-grants.server.actions";

// Matches Supabase's `OAuthGrant` shape
// (packages/core/auth-js/src/lib/types.ts) structurally, without importing
// it directly.
interface Grant {
  client: { id: string; name: string };
  scopes: string[];
  granted_at: string;
}

export function ConnectionsList({ grants }: { grants: Grant[] }) {
  const [isPending, startTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <Card className="relative z-10 w-full max-w-sm bg-[#faf9f4] border-[#c8d4a8]">
        <CardHeader className="flex flex-col items-center pb-2">
          <MHacksLogo size={48} variant="green" />
          <h1
            className="mt-2 font-heading italic text-4xl tracking-tight text-center"
            style={{ color: "#3A4A26" }}
          >
            Connected apps
          </h1>
          <p
            className="mt-2 font-red-hat text-[13px] text-center"
            style={{ color: "rgba(58,74,38,0.6)" }}
          >
            Apps you&apos;ve given access to your MHacks account. Revoking an
            app signs it out immediately.
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {grants.length === 0 ? (
            <p
              className="font-red-hat text-[13px] text-center"
              style={{ color: "rgba(58,74,38,0.6)" }}
            >
              No connected apps yet.
            </p>
          ) : (
            grants.map((grant) => (
              <div
                key={grant.client.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#c8d4a8] px-3 py-2"
              >
                <div className="min-w-0">
                  <p
                    className="font-red-hat text-[14px] font-medium truncate"
                    style={{ color: "#3A4A26" }}
                  >
                    {grant.client.name}
                  </p>
                  <p
                    className="font-red-hat text-[12px] truncate"
                    style={{ color: "rgba(58,74,38,0.6)" }}
                  >
                    {grant.scopes.join(", ")} · since{" "}
                    {new Date(grant.granted_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    setRevokingId(grant.client.id);
                    startTransition(() => revokeGrant(grant.client.id));
                  }}
                  className="shrink-0 rounded-full font-red-hat text-[13px] cursor-pointer border-[#c8d4a8]"
                  style={{ color: "#3A4A26" }}
                >
                  {isPending && revokingId === grant.client.id
                    ? "Revoking…"
                    : "Revoke"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
