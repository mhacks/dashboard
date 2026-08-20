import type { Metadata } from "next";

import { LiveEvents } from "./live-events";
import { LIVE_SCHEDULE } from "./schedule";

export const metadata: Metadata = {
  title: "Live Timeline | MHacks 2026",
  description: "The live MHacks schedule for events, workshops, and updates.",
};

export default function LivePage() {
  return <LiveEvents events={LIVE_SCHEDULE} />;
}
