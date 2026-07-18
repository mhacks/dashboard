"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { getPageCount } from "@/lib/pagination";

type ListPaginationProps = {
  pageIndex: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
  className?: string;
};

export function ListPagination({
  pageIndex,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: ListPaginationProps) {
  const pageCount = getPageCount(totalItems, pageSize);
  if (pageCount <= 1) return null;

  const start = pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, totalItems);
  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageIndex < pageCount - 1;

  function goToPage(nextPageIndex: number) {
    onPageChange(Math.min(Math.max(nextPageIndex, 0), pageCount - 1));
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2",
        className,
      )}
    >
      <p className="min-w-0 truncate text-xs text-muted-foreground">
        {start}–{end} of {totalItems}
      </p>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text=""
              aria-disabled={!canGoPrevious}
              className={cn(
                "size-7 px-0 [&_span]:hidden",
                !canGoPrevious && "pointer-events-none opacity-50",
              )}
              onClick={(event) => {
                event.preventDefault();
                if (canGoPrevious) goToPage(pageIndex - 1);
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-2 text-xs font-medium text-muted-foreground tabular-nums">
              Page {pageIndex + 1} of {pageCount}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              text=""
              aria-disabled={!canGoNext}
              className={cn(
                "size-7 px-0 [&_span]:hidden",
                !canGoNext && "pointer-events-none opacity-50",
              )}
              onClick={(event) => {
                event.preventDefault();
                if (canGoNext) goToPage(pageIndex + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
