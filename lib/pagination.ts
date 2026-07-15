export function getPageCount(totalItems: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function paginateSlice<T>(
  items: T[],
  pageIndex: number,
  pageSize: number,
): T[] {
  const start = pageIndex * pageSize;
  return items.slice(start, start + pageSize);
}

export function clampPageIndex(pageIndex: number, pageCount: number) {
  return Math.min(Math.max(pageIndex, 0), pageCount - 1);
}
