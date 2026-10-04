import type { Metadata } from "next";
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

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Puzzle" };

/*
  Stage two of the puzzle hunt. Reached only with an organizer's code;
  everyone else goes back to the map. PLACEHOLDER until the puzzle is built.
*/
export default async function HuntPuzzlePage() {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${HUNT_PUZZLE_PATH}`);
  if (!(await canJoinHunt(user)) || !(await hasUnlockedHunt(user.id))) {
    redirect("/find-my-organizer");
  }

  return (
    <div className="font-red-hat">
      <ConsoleShell>
        <ConsolePage>
          <Masthead title="Puzzle" />
          <Panel eyebrow="PUZZLE HUNT">
            <PanelHeading lede="You found an organizer. The next puzzle opens here soon.">
              Unlocked
            </PanelHeading>
            <ButtonLink
              href="/find-my-organizer"
              external={false}
              variant="outline"
            >
              Back to the map
            </ButtonLink>
          </Panel>
          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}
