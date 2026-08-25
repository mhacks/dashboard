import { format } from "date-fns";
import Link from "next/link";

import {
  ConsolePage,
  ConsoleShell,
  Masthead,
} from "@/components/console/shell";
import { Panel, PanelHeading } from "@/components/console/panel";
import { getOpenEventsForStaff } from "@/lib/queries/events";

export const dynamic = "force-dynamic";

/**
 * Which event am I scanning for? Answering that is the whole page.
 *
 * Only open events appear — a closed one is closed for volunteers too, and
 * listing it would invite scanning people into a night that already ended.
 */
export default async function CheckInPickerPage() {
  const events = await getOpenEventsForStaff();

  return (
    <ConsoleShell>
      <ConsolePage>
        <Masthead
          title="Check-in"
          trailing={
            <Link
              href="/dashboard"
              className="font-red-hat-mono text-[11.5px] tracking-[0.02em] text-ui-ink-soft underline underline-offset-2 transition-colors hover:text-ui-ink"
            >
              Dashboard
            </Link>
          }
        />

        {events.length === 0 ? (
          <Panel eyebrow="CHECK-IN" status="Nothing open">
            <PanelHeading lede="An organizer needs to create an event and open it before anyone can be scanned in.">
              No events are open
            </PanelHeading>
          </Panel>
        ) : (
          <Panel eyebrow="CHECK-IN">
            <PanelHeading lede="Pick the event you're scanning for. Everyone you scan is checked into this event and no other, so make sure it's the right one.">
              Choose an event
            </PanelHeading>

            <ul className="flex flex-col border border-ui-line">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="border-b border-ui-line last:border-b-0"
                >
                  <Link
                    href={`/checkin/${event.slug}`}
                    className="flex items-center gap-3 px-3.5 py-3 no-underline transition-colors hover:bg-ui-selected"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-red-hat-mono text-[14.5px] font-medium text-ui-ink">
                        {event.name}
                      </span>
                      <span className="block truncate text-[12px] text-ui-ink-soft">
                        {[
                          event.location,
                          event.startsAt
                            ? format(
                                new Date(event.startsAt),
                                "EEE d MMM, h:mm a",
                              )
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No time set"}
                      </span>
                    </span>

                    <span className="shrink-0 font-red-hat-mono text-[11.5px] text-ui-ink-soft">
                      {event.checkinCount} in
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </ConsolePage>
    </ConsoleShell>
  );
}
