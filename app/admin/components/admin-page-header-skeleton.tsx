import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AdminPageHeaderSkeleton({
  variant = "workspace",
  withDescription = false,
  withFooter = false,
}: {
  variant?: "page" | "workspace";
  withDescription?: boolean;
  withFooter?: boolean;
}) {
  const isWorkspace = variant === "workspace";

  return (
    <header
      className={cn(
        isWorkspace
          ? "shrink-0 border-b bg-card/80 px-4 py-3 backdrop-blur md:px-6"
          : "border-b pb-6",
      )}
    >
      <div
        className={cn(
          "flex gap-4",
          isWorkspace
            ? "items-start justify-between"
            : "flex-col sm:flex-row sm:items-end sm:justify-between",
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
          {Array.from({ length: 2 }).map((_, index) => (
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
