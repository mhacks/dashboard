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
import {
  findOrganizerAccess,
  getMySharing,
  getOrganizerMap,
} from "@/lib/queries/organizer-locations";
import { PeopleView } from "./people-view";
import { SharingPanel } from "./sharing-panel";

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

  const [snapshot, sharing] = await Promise.all([
    getOrganizerMap(access),
    access === "organizer" ? getMySharing(user.id) : null,
  ]);

  return (
    <div className="font-red-hat">
      <ConsoleShell>
        <ConsolePage>
          <Masthead title="Find an organizer" trailing={<BackLink />} />

          {access === "organizer" ? <SharingPanel sharing={sharing} /> : null}

          <Panel eyebrow="MAP">
            <PanelHeading
              lede={
                access === "organizer"
                  ? "Everyone sharing their location, including anyone who has gone quiet."
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

          <ConsoleFooterRule />
        </ConsolePage>
      </ConsoleShell>
    </div>
  );
}
