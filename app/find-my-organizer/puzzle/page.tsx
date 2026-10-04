import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { HUNT_PUZZLE_PATH } from "@/lib/hunt/constants";
import { puzzleParagraphs } from "@/lib/hunt/puzzle-text";
import {
  canJoinHunt,
  getHuntFlower,
  hasUnlockedHunt,
} from "@/lib/queries/hunt";
import { isFindMyOrganizerHidden } from "@/lib/queries/organizer-locations";
import { BlockSelectAll } from "./block-select-all";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "…" };

/*
  Stage two of the puzzle hunt, reached only with an organizer's code. The
  page looks blank: the text is white on white, and highlighting it shows the
  riddle for this hacker's flower, which they find on the main page next.
*/
export default async function HuntPuzzlePage() {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${HUNT_PUZZLE_PATH}`);
  if (isFindMyOrganizerHidden(user)) notFound();
  if (!(await canJoinHunt(user)) || !(await hasUnlockedHunt(user.id))) {
    redirect("/find-my-organizer");
  }

  const flower = await getHuntFlower(user.id);
  if (!flower) redirect("/find-my-organizer");
  const paragraphs = puzzleParagraphs(user.id, flower.riddle);

  return (
    // Fixed colors, not theme tokens: the trick only works if the text is
    // exactly the page's white. Highlighting uses the site's ::selection,
    // light text on moss, which is what gives it away.
    <main className="relative min-h-dvh bg-white px-4 py-10 font-red-hat text-[#9a9a94] sm:px-10">
      <BlockSelectAll />
      <p className="text-base">Hmmm, blank page?</p>
      {/* Small and pinned into the top-right corner, away from where anyone
          would look for text. */}
      <div className="absolute top-2 right-2 w-[55%] max-w-[260px] text-[10px] leading-[1.45] text-white">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="mb-2">
            {paragraph}
          </p>
        ))}
      </div>
      <p className="absolute right-4 bottom-8 text-base sm:right-10">
        Is this the end?
      </p>
    </main>
  );
}
