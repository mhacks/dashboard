import { MailIcon } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import EmailCampaignsClient from "./campaigns-client";

export default async function EmailCampaignsPage() {
  if (process.env.ENABLE_EMAIL_CAMPAIGNS !== "true") {
    return (
      <AdminPageShell width="narrow">
        <AdminPageHeader
          title="Email Campaigns"
          description="Build, preview, and send organizer-managed email updates."
        />
        <div className="flex items-start gap-4 rounded-lg border bg-card p-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <MailIcon className="size-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Email studio unavailable</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              The email studio is not available for this environment yet.
            </p>
          </div>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Email Campaigns"
        description="Build reusable templates, preview merge fields, and send CSV-based campaigns."
      />
      <EmailCampaignsClient />
    </AdminPageShell>
  );
}
