import { redirect } from "next/navigation";
import { getReservationAuditPage } from "@/lib/queries/admin-reservations";
import { AuditList } from "./audit-list";
import {
  getCanonicalAuditPageHref,
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
  const canonicalHref = getCanonicalAuditPageHref(
    "/admin/teams/reservations/audit",
    resolvedSearchParams,
    requestedPage,
    auditPage.totalItems,
    auditPage.pageSize,
  );
  if (canonicalHref) redirect(canonicalHref);

  return (
    <AuditList {...auditPage} basePath="/admin/teams/reservations/audit" />
  );
}
