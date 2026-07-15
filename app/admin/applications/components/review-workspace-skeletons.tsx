import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SectionSkeleton({
  titleWidth,
  rows,
}: {
  titleWidth: string;
  rows: number;
}) {
  return (
    <section>
      <Skeleton className={cn("mb-3 h-4", titleWidth)} />
      <div className="divide-y divide-border/60 rounded-lg border bg-card px-4 py-1">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(9rem,34%)_1fr]"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ResumePreviewSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
      <Skeleton className="h-[320px] w-full rounded-none" />
    </div>
  );
}

export function ApplicationDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-7 p-4 pb-28 sm:p-5 md:p-6 lg:pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 w-56 sm:h-12" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-20 rounded-md" />
            ))}
          </div>
        </div>
      </div>

      <ResumePreviewSkeleton />

      <SectionSkeleton titleWidth="w-36" rows={4} />
      <SectionSkeleton titleWidth="w-40" rows={5} />

      <section>
        <Skeleton className="mb-3 h-4 w-16" />
        <div className="space-y-4 rounded-lg border bg-card px-4 py-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2 py-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </section>

      <SectionSkeleton titleWidth="w-24" rows={4} />
    </div>
  );
}

export function ReviewEventListSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: compact ? 2 : 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-dashed bg-background/40 px-3 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </div>
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewEventsSkeleton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border bg-muted/20 p-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      <div className="mt-3 min-w-0 space-y-2">
        <ReviewEventListSkeleton compact={compact} />
      </div>
    </div>
  );
}

function ApplicationsListSkeleton() {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>
      <div className="shrink-0 space-y-3 border-b p-3">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <div className="min-h-0 flex-1 divide-y overflow-hidden">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="flex h-12 shrink-0 items-center justify-between border-t px-4">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </>
  );
}

function ScorecardSkeleton() {
  return (
    <div className="space-y-5 p-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-px w-full" />
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-3 w-full max-w-sm" />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-11 w-full rounded-md" />
      <ReviewEventsSkeleton />
      <Skeleton className="h-11 w-full rounded-md" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export function ReviewWorkspacePageSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b bg-card/80 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-56 sm:h-9" />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-24 rounded-md" />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 overflow-hidden border-t bg-card lg:grid lg:grid-cols-[300px_minmax(0,1fr)_330px]">
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r bg-card">
          <ApplicationsListSkeleton />
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r bg-muted/30">
          <div className="flex h-14 items-center border-b bg-card px-4">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ApplicationDetailSkeleton />
          </div>
        </section>
        <aside className="min-h-0 min-w-0 overflow-hidden bg-card">
          <ScorecardSkeleton />
        </aside>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden border-t bg-card lg:hidden">
        <ApplicationsListSkeleton />
      </div>
    </div>
  );
}
