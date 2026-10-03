"use client";

import { useEffect } from "react";

import { Panel, PanelHeading } from "@/components/console/panel";
import {
  ConsoleFooterRule,
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

const ACTION_BUTTON =
  "shrink-0 cursor-pointer rounded-[2px] border px-3.5 py-2 font-red-hat-mono text-[12px] tracking-[0.02em] whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink";
const ACTION_PRIMARY = `${ACTION_BUTTON} border-ui-ink bg-ui-ink text-ui-surface hover:opacity-90`;

export default function JudgeError({
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
          <Masthead title="Judging" trailing={<SignOutButton />} />
          <Panel eyebrow="JUDGING" status="Unavailable">
            <PanelHeading lede="The floor plan or the judging API did not load. Retry in a moment.">
              Could not open judging
            </PanelHeading>
            <button type="button" className={ACTION_PRIMARY} onClick={reset}>
              Try again
            </button>
          </Panel>
          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}
