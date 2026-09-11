import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { getEventRoster } from "@/lib/queries/events";
import { eventSlugSchema } from "@/lib/types/events";
import { EventRoster } from "./event-roster";

export const dynamic = "force-dynamic";

export default async function AdminEventRosterPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;

  const parsed = eventSlugSchema.safeParse(eventSlug);
  if (!parsed.success) notFound();

  const roster = await getEventRoster(parsed.data);
  if (!roster) notFound();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={roster.event.name}
        description={
          roster.event.description ??
          "Everyone checked into this event, newest first."
        }
      />
      <EventRoster roster={roster} />
    </AdminPageShell>
  );
}
