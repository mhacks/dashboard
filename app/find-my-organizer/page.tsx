import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/console/button";
import { Panel, PanelHeading } from "@/components/console/panel";
import {
  ConsoleFooterRule,
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";
import { getSessionUser } from "@/lib/auth/session";
import { HUNT_PUZZLE_PATH } from "@/lib/hunt/constants";
import { canJoinHunt, hasUnlockedHunt } from "@/lib/queries/hunt";
import {
  findOrganizerAccess,
  getOrganizerMap,
} from "@/lib/queries/organizer-locations";
import { HuntCodeEntry } from "./hunt-code-entry";
import { PeopleView } from "./people-view";

// Reads live locations on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Find an organizer" };

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="rounded-[2px] border border-ui-line-strong bg-ui-paper px-2.5 py-[5px] font-red-hat-mono text-[10px] tracking-[0.14em] whitespace-nowrap text-ui-ink uppercase transition-colors duration-200 hover:bg-ui-selected focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-ink"
    >
      Dashboard
    </Link>
  );
}

export default async function FindMyOrganizerPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/find-my-organizer");

  const access = await findOrganizerAccess(user);

  if (access === "none") {
    return (
      <div className="font-red-hat">
        <ConsoleShell>
          <ConsolePage>
            <Masthead title="Find an organizer" trailing={<BackLink />} />
            <Panel eyebrow="AT THE VENUE">
              <PanelHeading lede="Once you've checked in at MHacks, this page shows where organizers are so you can find one when you need help.">
                Available after check-in
              </PanelHeading>
              <ButtonLink href="/dashboard" external={false} variant="outline">
                Back to your dashboard
              </ButtonLink>
            </Panel>
            <ConsoleFooterRule />
          </ConsolePage>
        </ConsoleShell>
      </div>
    );
  }

  const [snapshot, inHunt] = await Promise.all([
    getOrganizerMap(access),
    canJoinHunt(user),
  ]);
  const unlocked = inHunt && (await hasUnlockedHunt(user.id));

  return (
    <div className="font-red-hat">
      <ConsoleShell>
        <ConsolePage>
          <Masthead title="Find an organizer" trailing={<BackLink />} />

          <Panel eyebrow="MAP">
            <PanelHeading
              lede={
                access === "organizer"
                  ? "Everyone whose phone has reported in the last few hours, including anyone who has gone quiet."
                  : "Organizers who have shared their location recently. Tap a name to find them on the map."
              }
            >
              Where organizers are
            </PanelHeading>
            <PeopleView
              snapshot={snapshot}
              organizerView={access === "organizer"}
            />
          </Panel>

          {inHunt ? (
            <Panel eyebrow="PUZZLE HUNT">
              {unlocked ? (
                <>
                  <PanelHeading lede="You've already found an organizer. Pick up where you left off.">
                    Puzzle unlocked
                  </PanelHeading>
                  <ButtonLink href={HUNT_PUZZLE_PATH} external={false}>
                    Go to the puzzle
                  </ButtonLink>
                </>
              ) : (
                <>
                  <PanelHeading lede="Find an organizer on the map and ask them for a code. It works once, so ask for your own.">
                    Found one?
                  </PanelHeading>
                  <HuntCodeEntry />
                </>
              )}
            </Panel>
          ) : access === "organizer" ? (
            <Panel eyebrow="PUZZLE HUNT">
              <PanelHeading lede="When a hacker finds you, make them a one-time code.">
                Hunt codes
              </PanelHeading>
              <ButtonLink href="/admin/hunt-codes" external={false}>
                Make a code
              </ButtonLink>
            </Panel>
          ) : null}

          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}
