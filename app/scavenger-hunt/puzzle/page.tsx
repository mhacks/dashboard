import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { hiddenTextFor } from "@/lib/scavenger-hunt/phrase";

export const metadata: Metadata = {
  title: "Scavenger Hunt | MHacks 2026",
  robots: { index: false },
};

// POC: anyone signed in can open this. The real flow puts it behind the
// Find My Organizers OTP.
export default async function HiddenTextPuzzlePage() {
  const user = await getSessionUser();
  // /scavenger-hunt is a public path in the proxy, so guard this one here.
  if (!user) redirect("/login?next=/scavenger-hunt/puzzle");

  const { before, phrase, after } = hiddenTextFor(user.id);

  return (
    <main className="font-red-hat relative min-h-screen overflow-x-clip bg-paper">
      <p className="absolute top-6 left-1/2 -translate-x-1/2 text-sm text-ink/35 select-none">
        Hmmm, blank page?
      </p>

      {/* Same color as the background, so it only shows when selected. */}
      <p className="mx-auto max-w-4xl px-5 pt-24 pb-16 text-justify text-[15px] leading-7 text-paper selection:bg-olive selection:text-cream sm:px-8 sm:pt-32">
        {`${before} ${phrase} ${after}`}
      </p>
    </main>
  );
}
