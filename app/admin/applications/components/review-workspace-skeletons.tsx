import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function ApplicationReviewHeaderSkeleton({
  variant = "workspace",
  withDescription = false,
  withFooter = false,
}: {
  variant?: "workspace" | "dashboard";
  withDescription?: boolean;
  withFooter?: boolean;
}) {
  const isWorkspace = variant === "workspace";

  return (
    <header
      className={cn(
        isWorkspace
          ? "shrink-0 border-b bg-card/80 px-4 py-3 backdrop-blur md:px-6"
          : "border-b pb-5",
      )}
    >
      <div
        className={cn(
          "flex gap-3",
          isWorkspace
            ? "items-start justify-between"
            : "flex-col lg:flex-row lg:items-end lg:justify-between",
        )}
      >
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton
            className={cn(
              isWorkspace ? "h-8 w-56 sm:h-9" : "h-10 w-64 max-w-full",
            )}
          />
          {withDescription ? (
            <Skeleton className="h-4 w-full max-w-2xl" />
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-24 rounded-md" />
          ))}
        </div>
      </div>
      {withFooter ? (
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      ) : null}
    </header>
  );
}

function SummaryBarSkeleton({ items = 4 }: { items?: number }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card md:flex md:divide-x md:divide-border/60">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex min-w-0 flex-1 gap-3 px-4 py-4">
          <Skeleton className="size-5 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-full max-w-40" />
          </div>
        </div>
      ))}
    </section>
  );
}

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
        <div className="grid grid-cols-4 gap-1 rounded-lg border bg-muted/30 p-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-1 px-0.5 py-1.5"
            >
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
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
          <div className="grid grid-cols-5 gap-0">
            {Array.from({ length: 5 }).map((__, ratingIndex) => (
              <Skeleton
                key={ratingIndex}
                className={cn(
                  "h-10 rounded-none",
                  ratingIndex === 0 && "rounded-l-lg",
                  ratingIndex === 4 && "rounded-r-lg",
                )}
              />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-lg" />
      <ReviewEventsSkeleton />
      <Skeleton className="h-11 w-full rounded-md" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

function LeaderboardRowSkeleton({
  highlighted = false,
}: {
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 py-3",
        highlighted && "bg-amber-50/60 dark:bg-amber-950/20",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="shrink-0 space-y-2 text-right">
          <Skeleton className="ml-auto h-6 w-8" />
          <Skeleton className="ml-auto h-3 w-28" />
        </div>
      </div>
      <Skeleton className="mt-2.5 h-1.5 w-full rounded-full" />
    </div>
  );
}

function AuditActivityRowSkeleton() {
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="h-3 w-20 shrink-0" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-7 w-24 rounded-md" />
        <Skeleton className="h-7 w-28 rounded-md" />
      </div>
    </div>
  );
}

export function ReviewWorkspacePageSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <ApplicationReviewHeaderSkeleton withFooter />

      <div className="hidden min-h-0 flex-1 overflow-hidden border-t bg-card lg:grid lg:grid-cols-[300px_minmax(0,1fr)_330px]">
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r bg-card">
          <ApplicationsListSkeleton />
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r bg-muted/30">
          <div className="flex h-14 items-center justify-between gap-2 border-b bg-card px-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Skeleton className="hidden size-4 lg:block" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ApplicationDetailSkeleton />
          </div>
        </section>
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ScorecardSkeleton />
          </div>
        </aside>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-t bg-card lg:hidden">
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-card">
          <ApplicationsListSkeleton />
        </aside>
      </div>
    </div>
  );
}

export function LeaderboardPageSkeleton() {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <ApplicationReviewHeaderSkeleton variant="dashboard" withDescription />

        <SummaryBarSkeleton />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-sm" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-4 w-full max-w-xl" />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="divide-y divide-border/60">
              {Array.from({ length: 6 }).map((_, index) => (
                <LeaderboardRowSkeleton key={index} highlighted={index === 0} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-sm" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-4 w-full max-w-2xl" />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="divide-y divide-border/60">
              {Array.from({ length: 5 }).map((_, index) => (
                <AuditActivityRowSkeleton key={index} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-28 rounded-md" />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function AnalyticsCardHeaderSkeleton({
  titleWidth = "w-40",
  descriptionWidth = "max-w-md",
}: {
  titleWidth?: string;
  descriptionWidth?: string;
}) {
  return (
    <CardHeader>
      <Skeleton className={cn("h-5", titleWidth)} />
      <Skeleton className={cn("h-4 w-full", descriptionWidth)} />
    </CardHeader>
  );
}

function AnalyticsPieCardSkeleton() {
  return (
    <Card>
      <AnalyticsCardHeaderSkeleton />
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[minmax(200px,1fr)_220px]">
          <Skeleton className="mx-auto aspect-square h-[280px] w-full max-w-[280px] rounded-full" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 py-1"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Skeleton className="size-2.5 shrink-0 rounded-sm" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsBarCardSkeleton({
  height = "h-[280px]",
}: {
  height?: string;
}) {
  return (
    <Card>
      <AnalyticsCardHeaderSkeleton />
      <CardContent>
        <Skeleton className={cn("w-full rounded-lg", height)} />
      </CardContent>
    </Card>
  );
}

function AnalyticsPipelineCardSkeleton() {
  return (
    <Card className="h-full">
      <AnalyticsCardHeaderSkeleton
        titleWidth="w-32"
        descriptionWidth="max-w-sm"
      />
      <CardContent className="space-y-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index}>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="mt-2 h-2 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AnalyticsRankedListCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <AnalyticsCardHeaderSkeleton titleWidth="w-28" />
      <CardContent className="px-0 pb-0">
        <div className="divide-y divide-border/60">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="h-3 w-5 shrink-0" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
              <Skeleton className="mt-2 h-1 w-full rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsStatCardSkeleton() {
  return (
    <Card className="h-full">
      <AnalyticsCardHeaderSkeleton
        titleWidth="w-36"
        descriptionWidth="max-w-sm"
      />
      <CardContent>
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="mb-1 h-4 w-32" />
        </div>
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
        <Skeleton className="mt-2 h-3 w-48" />
      </CardContent>
    </Card>
  );
}

function AnalyticsTabsSkeleton() {
  return (
    <div className="flex w-full flex-wrap gap-4 border-b border-border/60 pb-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-8 rounded-md", index === 0 ? "w-20" : "w-24")}
        />
      ))}
    </div>
  );
}

function AnalyticsOverviewSkeleton() {
  return (
    <div className="mt-5 flex flex-col gap-5">
      <section className="grid gap-5 xl:grid-cols-2">
        <AnalyticsPieCardSkeleton />
        <AnalyticsPipelineCardSkeleton />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <AnalyticsPieCardSkeleton />
        <AnalyticsBarCardSkeleton />
        <AnalyticsRankedListCardSkeleton />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <AnalyticsStatCardSkeleton />
        <AnalyticsBarCardSkeleton />
      </section>
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <ApplicationReviewHeaderSkeleton variant="dashboard" withDescription />

        <SummaryBarSkeleton />

        <div>
          <AnalyticsTabsSkeleton />
          <AnalyticsOverviewSkeleton />
        </div>
      </div>
    </main>
  );
}
