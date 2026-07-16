import { Skeleton } from "@/components/ui/skeleton";
import { adminPageHeaderClasses } from "./admin-page-header-layout";

export function AdminPageHeaderSkeleton({
  variant = "workspace",
  withDescription = false,
  withFooter = false,
}: {
  variant?: "page" | "workspace";
  withDescription?: boolean;
  withFooter?: boolean;
}) {
  const classes = adminPageHeaderClasses(variant);

  return (
    <header className={classes.header}>
      <div className={classes.row}>
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton
            className={
              variant === "workspace"
                ? "h-8 w-56 sm:h-9"
                : "h-10 w-64 max-w-full"
            }
          />
          {withDescription ? (
            <Skeleton className="h-4 w-full max-w-2xl" />
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
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
