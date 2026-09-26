"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { unlinkDiscord } from "@/lib/actions/discord-link.server.actions";
import { revokeGrant } from "@/lib/actions/oauth-grants.server.actions";

// Matches Supabase's `OAuthGrant` shape
// (packages/core/auth-js/src/lib/types.ts) structurally, without importing
// it directly.
interface Grant {
  client: { id: string; name: string };
  scopes: string[];
  granted_at: string;
}

const DISCORD_ROW = "discord";

export function ConnectionsList({
  grants,
  discord,
}: {
  grants: Grant[];
  discord: { discordUsername: string | null } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);

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
          {discord && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#c8d4a8] px-3 py-2">
              <div className="min-w-0">
                <p
                  className="font-red-hat text-[14px] font-medium truncate"
                  style={{ color: "#3A4A26" }}
                >
                  Discord
                </p>
                <p
                  className="font-red-hat text-[12px] truncate"
                  style={{ color: "rgba(58,74,38,0.6)" }}
                >
                  {discord.discordUsername
                    ? `@${discord.discordUsername}`
                    : "Linked"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Unlink this Discord account? You can link it again from Discord's Verify button.",
                    )
                  )
                    return;
                  setRevokingId(DISCORD_ROW);
                  startTransition(() => unlinkDiscord());
                }}
                className="shrink-0 rounded-full font-red-hat text-[13px] cursor-pointer border-[#c8d4a8]"
                style={{ color: "#3A4A26" }}
              >
                {isPending && revokingId === DISCORD_ROW
                  ? "Unlinking…"
                  : "Unlink"}
              </Button>
            </div>
          )}

          {grants.length === 0 && !discord ? (
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

          {/* The dashboard's masthead links here, so this is the way back. */}
          <Link
            href="/dashboard"
            className="self-center font-red-hat text-[13px] underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: "#3A4A26" }}
          >
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
