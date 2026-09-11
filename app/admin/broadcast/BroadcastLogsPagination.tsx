"use client";

import { usePathname, useRouter } from "next/navigation";
import { ListPagination } from "@/app/admin/applications/components/list-pagination";
import { buildBroadcastLogsQuery } from "./broadcast-log-query";

type BroadcastLogsPaginationProps = {
  pageIndex: number;
  totalCount: number;
  pageSize: number;
  searchQuery: string;
};

export function BroadcastLogsPagination({
  pageIndex,
  totalCount,
  pageSize,
  searchQuery,
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
          `${pathname}${buildBroadcastLogsQuery({
            q: searchQuery || undefined,
            logsPage: nextPageIndex === 0 ? undefined : nextPageIndex + 1,
          })}`,
        );
      }}
    />
  );
}
