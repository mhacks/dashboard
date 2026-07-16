import Link from "next/link";
import { FileTextIcon, PaletteIcon, SendIcon } from "lucide-react";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import EmailCampaignsClient, {
  type EmailCampaignSurface,
} from "./campaigns-client";

const emailCampaignViews: Array<{
  value: EmailCampaignSurface;
  label: string;
  icon: typeof FileTextIcon;
}> = [
  { value: "builder", label: "Builder", icon: FileTextIcon },
  { value: "styles", label: "Styles", icon: PaletteIcon },
  { value: "send", label: "Send", icon: SendIcon },
];

export default async function EmailCampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[] }>;
}) {
  const params = await searchParams;
  const activeView = parseEmailCampaignView(params?.view);

  return (
    <AdminPageShell width="full">
      <AdminPageHeader
        title="Email Campaigns"
        description="Build reusable templates, preview merge fields, and send CSV-based campaigns."
        actions={<EmailCampaignViewNav activeView={activeView} />}
      />
      <EmailCampaignsClient initialSurface={activeView} />
    </AdminPageShell>
  );
}

function EmailCampaignViewNav({
  activeView,
}: {
  activeView: EmailCampaignSurface;
}) {
  return (
    <nav
      aria-label="Email campaign workspace"
      className="flex flex-wrap items-center gap-2"
    >
      {emailCampaignViews.map(({ value, label, icon: Icon }) => {
        const active = activeView === value;

        return (
          <Button
            key={value}
            asChild
            variant={active ? "default" : "outline"}
            size="sm"
            className={cn(!active && "bg-card text-muted-foreground")}
          >
            <Link
              href={
                value === "builder"
                  ? "/admin/email-campaigns"
                  : `/admin/email-campaigns?view=${value}`
              }
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

function parseEmailCampaignView(
  value: string | string[] | undefined,
): EmailCampaignSurface {
  const view = Array.isArray(value) ? value[0] : value;

  if (view === "styles" || view === "send") {
    return view;
  }

  return "builder";
}
