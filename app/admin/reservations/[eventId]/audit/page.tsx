import { redirect } from "next/navigation";
import { getReservationAuditPage } from "@/lib/queries/admin-reservations";
import { AuditList } from "../../audit/audit-list";
import {
  buildAuditPageHref,
  getAuditPageCount,
  parseRequestedAuditPage,
  type AuditRouteSearchParams,
} from "../../audit/audit-pagination";

export const dynamic = "force-dynamic";

export default async function ReservationEventAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<AuditRouteSearchParams>;
}) {
  const [{ eventId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const requestedPage = parseRequestedAuditPage(resolvedSearchParams.page);
  const auditPage = await getReservationAuditPage({
    eventId,
    pageIndex: requestedPage.pageNumber - 1,
  });
  const pageCount = getAuditPageCount(auditPage.totalItems, auditPage.pageSize);
  const normalizedPage = Math.min(requestedPage.pageNumber, pageCount);

  if (
    !requestedPage.isCanonical ||
    normalizedPage !== requestedPage.pageNumber
  ) {
    redirect(
      buildAuditPageHref(
        `/admin/reservations/${eventId}/audit`,
        resolvedSearchParams,
        normalizedPage,
      ),
    );
  }

  return (
    <section
      aria-labelledby="event-audit-heading"
      className="flex flex-col gap-4"
    >
      <div>
        <h2
          id="event-audit-heading"
          className="font-heading text-xl font-medium"
        >
          Event audit log
        </h2>
        <p className="text-sm text-muted-foreground">
          Immutable organizer and participant activity for this event.
        </p>
      </div>
      <AuditList
        {...auditPage}
        basePath={`/admin/reservations/${eventId}/audit`}
      />
    </section>
  );
}
