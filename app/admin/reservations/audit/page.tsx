import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/app/admin/components/admin-page-header";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { getReservationAuditPage } from "@/lib/queries/admin-reservations";
import { AuditList } from "./audit-list";
import {
  buildAuditPageHref,
  getAuditPageCount,
  parseRequestedAuditPage,
  type AuditRouteSearchParams,
} from "./audit-pagination";

export const dynamic = "force-dynamic";

export default async function ReservationAuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditRouteSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedPage = parseRequestedAuditPage(resolvedSearchParams.page);
  const auditPage = await getReservationAuditPage({
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
        "/admin/reservations/audit",
        resolvedSearchParams,
        normalizedPage,
      ),
    );
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Reservation audit log"
        description="Review immutable event, table, participant, and assignment activity across all reservation events."
      />
      <AuditList {...auditPage} basePath="/admin/reservations/audit" />
    </AdminPageShell>
  );
}
