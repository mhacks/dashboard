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

export function getAuditPageCount(
  totalItems: number,
  pageSize: number,
): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
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
