"use client";

import { usePathname, useRouter } from "next/navigation";
import { ListPagination } from "@/app/admin/applications/components/list-pagination";

type BroadcastLogsPaginationProps = {
  pageIndex: number;
  totalCount: number;
  pageSize: number;
};

export function BroadcastLogsPagination({
  pageIndex,
  totalCount,
  pageSize,
}: BroadcastLogsPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <ListPagination
      pageIndex={pageIndex}
      totalItems={totalCount}
      pageSize={pageSize}
      onPageChange={(nextPageIndex) => {
        const query =
          nextPageIndex === 0 ? "" : `?logsPage=${nextPageIndex + 1}`;
        router.push(`${pathname}${query}#broadcast-logs`);
      }}
    />
  );
}
