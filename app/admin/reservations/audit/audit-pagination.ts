import { clampPageIndex, getPageCount } from "@/lib/pagination";

export type AuditRouteSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type RequestedAuditPage = {
  pageNumber: number;
  isCanonical: boolean;
};

export function parseRequestedAuditPage(
  value: string | string[] | undefined,
): RequestedAuditPage {
  if (value === undefined) {
    return { pageNumber: 1, isCanonical: true };
  }

  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^[1-9]\d*$/.test(candidate)) {
    return { pageNumber: 1, isCanonical: false };
  }

  const pageNumber = Number(candidate);
  if (!Number.isSafeInteger(pageNumber)) {
    return { pageNumber: 1, isCanonical: false };
  }

  return {
    pageNumber,
    isCanonical: !Array.isArray(value) && candidate === String(pageNumber),
  };
}

export function buildAuditPageHref(
  basePath: string,
  searchParams: AuditRouteSearchParams,
  pageNumber: number,
): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    } else {
      next.set(key, value);
    }
  }

  next.set("page", String(pageNumber));
  return `${basePath}?${next.toString()}`;
}

export function getCanonicalAuditPageHref(
  basePath: string,
  searchParams: AuditRouteSearchParams,
  requestedPage: RequestedAuditPage,
  totalItems: number,
  pageSize: number,
): string | null {
  const normalizedPage =
    clampPageIndex(
      requestedPage.pageNumber - 1,
      getPageCount(totalItems, pageSize),
    ) + 1;
  if (
    requestedPage.isCanonical &&
    normalizedPage === requestedPage.pageNumber
  ) {
    return null;
  }
  return buildAuditPageHref(basePath, searchParams, normalizedPage);
}
