import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { HUNT_PUZZLE_PATH } from "@/lib/hunt/constants";
import { assignedFlower } from "@/lib/hunt/flowers";
import { puzzleParagraphs } from "@/lib/hunt/puzzle-text";
import { canJoinHunt, hasUnlockedHunt } from "@/lib/queries/hunt";

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
  if (!(await canJoinHunt(user)) || !(await hasUnlockedHunt(user.id))) {
    redirect("/find-my-organizer");
  }

  const paragraphs = puzzleParagraphs(user.id, assignedFlower(user.id).riddle);

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
