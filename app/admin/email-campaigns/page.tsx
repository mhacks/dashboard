import { Mail } from "lucide-react";
import EmailCampaignsClient from "./campaigns-client";

export default async function EmailCampaignsPage() {
  if (process.env.ENABLE_EMAIL_CAMPAIGNS !== "true") {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
        <div className="mx-auto flex max-w-2xl items-start gap-4 rounded-lg border border-border bg-white p-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
            <Mail className="size-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Email studio unavailable</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              The email studio is not available for this environment yet.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return <EmailCampaignsClient />;
}
