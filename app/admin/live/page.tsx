import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { Button } from "@/components/ui/button";
import { getOrganizerLiveSiteContent } from "@/lib/queries/live-site";
import { LiveSiteManager } from "./live-site-manager";

export const dynamic = "force-dynamic";

export default async function AdminLivePage() {
  const content = await getOrganizerLiveSiteContent();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Live site"
        description="Publish the schedule and maintain attendee-facing weekend information."
        actions={
          <Button asChild variant="outline">
            <Link href="/live" target="_blank">
              Open live site
              <ArrowUpRightIcon />
            </Link>
          </Button>
        }
      />
      <LiveSiteManager initialContent={content} />
    </AdminPageShell>
  );
}
