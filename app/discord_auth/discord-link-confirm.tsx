"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { MHacksLogo } from "@/components/mhacks-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { logout } from "@/lib/actions/auth.server.actions";
import { confirmDiscordLink } from "@/lib/actions/discord-link.server.actions";

const INK = "#3A4A26";
const MUTED = "rgba(58,74,38,0.6)";

export type DiscordLinkState =
  | {
      kind: "confirm";
      token: string;
      email: string;
      discordUsername: string;
      discordUserId: string;
      /** Set only when a *different* Discord account is already linked. */
      existing: { discordUsername: string | null } | null;
    }
  | { kind: "invalid"; reason: "malformed" | "expired" }
  | { kind: "ineligible"; token: string; email: string }
  | { kind: "misconfigured" };

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
            style={{ color: INK }}
          >
            {title}
          </h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">{children}</CardContent>
      </Card>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-red-hat text-[13px] text-center"
      style={{ color: MUTED }}
    >
      {children}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg border border-[#c8d4a8] px-3 py-2">
      <span className="font-red-hat text-[12px]" style={{ color: MUTED }}>
        {label}
      </span>
      <span
        className="font-red-hat text-[14px] font-medium truncate"
        style={{ color: INK }}
      >
        {value}
      </span>
    </div>
  );
}

export function DiscordLinkConfirm({ state }: { state: DiscordLinkState }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<string | null>(null);

  if (state.kind === "misconfigured") {
    return (
      <Shell title="Something's off">
        <Note>
          Discord linking isn&apos;t configured right now. Please email
          hackathon@mhacks.org.
        </Note>
      </Shell>
    );
  }

  if (state.kind === "invalid") {
    return (
      <Shell
        title={state.reason === "expired" ? "Link expired" : "Invalid link"}
      >
        <Note>
          {state.reason === "expired"
            ? "Verification links are only good for 15 minutes."
            : "That link couldn't be read."}{" "}
          Head back to Discord and click <strong>Verify</strong> for a fresh
          one.
        </Note>
      </Shell>
    );
  }

  if (state.kind === "ineligible") {
    return (
      <Shell title="Can't link yet">
        <Row label="MHacks" value={state.email} />
        <Note>
          Only hackers who have RSVP&apos;d and MHacks staff can link Discord.
          If you signed in with the wrong email, sign out and use the one you
          applied with. Otherwise, email hackathon@mhacks.org.
        </Note>
        <Button
          type="button"
          disabled={isPending}
          onClick={() =>
            // Back through /login to this same link, so the Discord side of it
            // survives the switch of account.
            startTransition(() =>
              logout(`/discord_auth?t=${encodeURIComponent(state.token)}`),
            )
          }
          className="rounded-full font-red-hat text-[13px] cursor-pointer"
        >
          {isPending ? "Signing out…" : "Sign out and switch account"}
        </Button>
      </Shell>
    );
  }

  if (linked) {
    return (
      <Shell title="Discord linked">
        <Row label="Discord" value={`@${linked}`} />
        <Note>
          Now go back to Discord and click{" "}
          <strong>I&apos;ve linked my account</strong> to get your role. You can
          close this tab.
        </Note>
      </Shell>
    );
  }

  const replacing = state.existing !== null;

  return (
    <Shell title={replacing ? "Replace your Discord?" : "Link your Discord"}>
      {replacing && (
        <p
          className="font-red-hat text-[13px] rounded-lg border border-[#c8a8a8] bg-[#f7efe9] px-3 py-2"
          style={{ color: INK }}
        >
          This MHacks account is already linked to{" "}
          <strong>
            {state.existing?.discordUsername
              ? `@${state.existing.discordUsername}`
              : "another Discord account"}
          </strong>
          . Linking this one will replace it, and the old account will lose its
          role.
        </p>
      )}

      <Row label="Discord" value={`@${state.discordUsername}`} />
      <Row label="MHacks" value={state.email} />

      {error && (
        <p
          className="font-red-hat text-[13px] text-center"
          style={{ color: "#8a2f2f" }}
        >
          {error}
        </p>
      )}

      <Button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await confirmDiscordLink(state.token);
            if (result.ok) setLinked(result.discordUsername);
            else setError(result.error);
          });
        }}
        className="rounded-full font-red-hat text-[13px] cursor-pointer"
      >
        {isPending
          ? "Linking…"
          : replacing
            ? "Replace and link"
            : "Link account"}
      </Button>

      <Note>
        Only do this if you clicked <strong>Verify</strong> in the MHacks
        Discord yourself.
      </Note>
    </Shell>
  );
}
