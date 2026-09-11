import Link from "next/link";
import { notFound } from "next/navigation";

import { Panel, PanelHeading } from "@/components/console/panel";
import {
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";
import { getEventCheckinCount, getEventForStaff } from "@/lib/queries/events";
import { eventSlugSchema } from "@/lib/types/events";
import { CheckInScanner } from "./check-in-scanner";

export const dynamic = "force-dynamic";

export default async function CheckInScannerPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;

  const parsed = eventSlugSchema.safeParse(eventSlug);
  if (!parsed.success) notFound();

  const event = await getEventForStaff(parsed.data);
  if (!event) notFound();

  const checkedInCount = await getEventCheckinCount(event.id);

  return (
    <ConsoleShell>
      <ConsolePage>
        <Masthead
          title={event.name}
          trailing={
            <Link
              href="/checkin"
              className="font-red-hat-mono text-[11.5px] tracking-[0.02em] text-ui-ink-soft underline underline-offset-2 transition-colors hover:text-ui-ink"
            >
              Change event
            </Link>
          }
        />

        {event.isActive ? (
          <Panel eyebrow="SCANNING" status={event.location ?? undefined}>
            <CheckInScanner
              slug={event.slug}
              eventName={event.name}
              initialCheckedInCount={checkedInCount}
            />
          </Panel>
        ) : (
          // Reachable by a bookmarked link after a lead closes the event. The
          // action would refuse anyway; saying so here beats a camera that
          // scans and rejects everyone.
          <Panel eyebrow="SCANNING" status="Closed">
            <PanelHeading lede="An organizer has closed this event, so nobody else can be checked in. Pick a different event, or ask a lead to reopen it.">
              This event is closed
            </PanelHeading>
          </Panel>
        )}
      </ConsolePage>
    </ConsoleShell>
  );
}
