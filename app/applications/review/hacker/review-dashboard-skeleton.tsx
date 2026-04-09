import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function InfoRowSkeleton() {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-4 w-40 shrink-0" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

function CardSectionSkeleton({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" aria-label={title} />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function ReviewDashboardSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Left panel: applicant list ───────────────────────────────────── */}
      <div className="w-80 shrink-0 border-r flex flex-col">
        <div className="p-4 border-b space-y-1.5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3 w-24" />
        </div>

        <div className="overflow-y-auto flex-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel: application detail + review form ────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          {/* Personal & Academic */}
          <CardSectionSkeleton title="Personal & Academic">
            <div className="space-y-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <InfoRowSkeleton key={i} />
              ))}
            </div>
          </CardSectionSkeleton>

          {/* Essays */}
          <CardSectionSkeleton title="Essays">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-20 w-full" />
                  {i < 2 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </CardSectionSkeleton>

          {/* Logistics */}
          <CardSectionSkeleton title="Logistics">
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <InfoRowSkeleton key={i} />
              ))}
            </div>
          </CardSectionSkeleton>

          {/* Socials & Resume */}
          <CardSectionSkeleton title="Socials & Resume">
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          </CardSectionSkeleton>

          {/* Review Form */}
          <CardSectionSkeleton title="Review">
            <div className="space-y-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}

              <Separator />

              {/* Flag checkbox */}
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-28" />
              </div>

              {/* Submit button */}
              <div className="flex justify-end pt-2">
                <Skeleton className="h-10 w-36" />
              </div>
            </div>
          </CardSectionSkeleton>
        </div>
      </div>
    </div>
  );
}
