import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { RsvpSummary } from "@/app/rsvp/rsvp-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAdminRsvpDetail } from "@/lib/queries/admin-rsvps";

export const dynamic = "force-dynamic";

export default async function AdminRsvpDetailPage({
  params,
}: {
  params: Promise<{ applicationSlug: string }>;
}) {
  const { applicationSlug } = await params;
  const detail = await getAdminRsvpDetail(applicationSlug);
  if (!detail) notFound();

  return (
    <AdminPageShell width="narrow">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/rsvps">
            <ArrowLeftIcon data-icon="inline-start" />
            RSVP responses
          </Link>
        </Button>
      </div>
      <AdminPageHeader
        title={detail.summary.preferredName || detail.summary.applicationName}
        description={`${detail.summary.accountEmail} · ${detail.summary.applicationSlug}`}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              Application: {detail.summary.applicationName}
            </p>
            <p className="text-xs text-muted-foreground">
              {detail.summary.rsvpEmail
                ? `RSVP email: ${detail.summary.rsvpEmail}`
                : "No finalized RSVP email"}
            </p>
          </div>
          {detail.summary.status === "submitted" ? (
            <Badge>Submitted</Badge>
          ) : detail.summary.status === "in_progress" ? (
            <Badge variant="secondary">In progress</Badge>
          ) : (
            <Badge variant="outline">Not started</Badge>
          )}
        </CardContent>
      </Card>

      {detail.values ? (
        <RsvpSummary
          values={detail.values}
          receiptHref={
            detail.hasReceipt
              ? `/admin/rsvps/${detail.summary.applicationSlug}/receipt`
              : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <h2 className="font-heading text-2xl italic">
              No final response yet
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Draft answers remain private until the applicant submits.
            </p>
          </CardContent>
        </Card>
      )}
    </AdminPageShell>
  );
}
