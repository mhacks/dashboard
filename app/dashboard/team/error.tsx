"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Panel, PanelHeading } from "@/components/console/panel";
import {
  ConsoleFooterRule,
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

const ACTION_BUTTON =
  "shrink-0 cursor-pointer rounded-[2px] border px-3.5 py-2 font-red-hat-mono text-[12px] tracking-[0.02em] whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink disabled:cursor-not-allowed disabled:opacity-50";
const ACTION_PRIMARY = `${ACTION_BUTTON} border-ui-ink bg-ui-ink text-ui-surface hover:opacity-90`;
const ACTION_OUTLINE = `${ACTION_BUTTON} border-ui-line-strong bg-transparent text-ui-ink hover:bg-ui-selected`;

/**
 * Route-segment error boundary for /dashboard/team. Catches the throw that
 * TeamData (page.tsx) deliberately lets through on a fetch failure — see the
 * comment there — and renders it as an in-shell message with a retry instead
 * of Next's default error page, without weakening that "never silently
 * degrade to no-team" guarantee.
 */
export default function TeamError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="font-red-hat">
      <ConsoleShell fieldSrc="/mhacks_blue_auth_bg.png">
        <ConsolePage>
          <Masthead title="Your team" trailing={<SignOutButton />} />

          <Panel eyebrow="YOUR TEAM" status="Couldn't load">
            <PanelHeading lede="Something went wrong loading your team. Nothing was changed, so it's safe to try again.">
              We hit a snag
            </PanelHeading>

            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={reset} className={ACTION_PRIMARY}>
                Try again
              </button>
              <Link href="/dashboard" className={ACTION_OUTLINE}>
                Back to dashboard
              </Link>
            </div>

            {error.digest ? (
              <p className="font-red-hat-mono text-[11px] text-ui-ink-soft">
                Reference: {error.digest}
              </p>
            ) : null}
          </Panel>

          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}
