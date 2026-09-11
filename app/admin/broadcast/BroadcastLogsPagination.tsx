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
        router.push(
          nextPageIndex === 0
            ? pathname
            : `${pathname}?logsPage=${nextPageIndex + 1}`,
        );
      }}
    />
  );
}
