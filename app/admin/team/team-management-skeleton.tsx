import { AdminPageHeaderSkeleton } from "@/app/admin/components/admin-page-header-skeleton";
import { AdminPageShell } from "@/app/admin/components/admin-page-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function InviteRowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <Skeleton className="size-8 shrink-0 rounded-md" />
    </div>
  );
}

export function TeamManagementSkeleton() {
  return (
    <AdminPageShell>
      <AdminPageHeaderSkeleton variant="page" withDescription />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="size-5 rounded-sm" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-4 w-full max-w-2xl" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="flex items-end">
              <Skeleton className="h-10 w-24 rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-10 w-full max-w-xs rounded-md" />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="divide-y divide-border/60">
            {Array.from({ length: 5 }).map((_, index) => (
              <InviteRowSkeleton key={index} />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2">
            <Skeleton className="h-3 w-20" />
            <div className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-7 rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
