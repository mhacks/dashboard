import type { Metadata } from "next";

import { getPublicLiveSiteContent } from "@/lib/queries/live-site";
import { LiveEvents } from "./live-events";

export const metadata: Metadata = {
  title: "Live Timeline | MHacks 2026",
  description: "The live MHacks schedule for events, workshops, and updates.",
};

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const content = await getPublicLiveSiteContent();

  return (
    <LiveEvents
      announcements={content.announcements}
      events={content.events}
      guideLinks={content.guideLinks}
      prizes={content.prizes}
      settings={content.settings}
    />
  );
}
