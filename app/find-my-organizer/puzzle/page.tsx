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
import { puzzleKey } from "@/lib/hunt/puzzle-key";
import { puzzleParagraphs } from "@/lib/hunt/puzzle-text";
import {
  canJoinHunt,
  getLinkedDiscordId,
  hasUnlockedHunt,
} from "@/lib/queries/hunt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "…" };

/** A plain console page for the two states that aren't the puzzle. */
function Notice({ heading, lede }: { heading: string; lede: string }) {
  return (
    <div className="font-red-hat">
      <ConsoleShell>
        <ConsolePage>
          <Masthead title="Puzzle" />
          <Panel eyebrow="PUZZLE HUNT">
            <PanelHeading lede={lede}>{heading}</PanelHeading>
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

/*
  Stage two of the puzzle hunt, reached only with an organizer's code. The
  page looks blank: the text is white on white, and highlighting it shows the
  sentence that carries this hacker's key for the Discord bot's /unlock.
*/
export default async function HuntPuzzlePage() {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${HUNT_PUZZLE_PATH}`);
  if (!(await canJoinHunt(user)) || !(await hasUnlockedHunt(user.id))) {
    redirect("/find-my-organizer");
  }

  const discordId = await getLinkedDiscordId(user.id);
  if (!discordId) {
    return (
      <Notice
        heading="Link your Discord first"
        lede="The next part of the hunt happens in the MHacks Discord. Press Verify there to link your account, then come back to this page."
      />
    );
  }

  // The secret the bot already shares for link tokens; puzzleKey() gives the
  // key its own HKDF label.
  const secret = process.env.DISCORD_LINK_SECRET;
  if (!secret) {
    // Must match the bot's, or every key would be refused; fail visibly.
    console.error(
      "DISCORD_LINK_SECRET is not set; the hunt puzzle can't make keys.",
    );
    return (
      <Notice
        heading="Not quite ready"
        lede="This puzzle isn't switched on yet. Let an organizer know."
      />
    );
  }

  const paragraphs = puzzleParagraphs(user.id, puzzleKey(secret, discordId));

  return (
    // Fixed colors, not theme tokens: the trick only works if the text is
    // exactly the page's white. Highlighting uses the site's ::selection,
    // light text on moss, which is what gives it away.
    <main className="min-h-dvh bg-white px-4 py-10 font-red-hat text-[#9a9a94] sm:px-10">
      <p className="text-sm">Hmmm, blank page?</p>
      <div className="mt-16 max-w-3xl text-[15px] leading-[1.7] text-white sm:ml-[12%]">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="mb-6">
            {paragraph}
          </p>
        ))}
      </div>
      <p className="mt-24 text-right text-sm">Is this the end?</p>
    </main>
  );
}
