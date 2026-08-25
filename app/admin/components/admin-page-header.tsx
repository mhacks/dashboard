import type { ReactNode } from "react";
import { AdminHeaderActions } from "./admin-header-actions";
import { adminPageHeaderClasses } from "./admin-page-header-layout";

export function AdminPageHeader({
  title,
  description,
  variant = "page",
  actions,
  footer,
}: {
  title: string;
  description?: string;
  variant?: "page" | "workspace";
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const classes = adminPageHeaderClasses(variant);

  return (
    <header className={classes.header}>
      <div className={classes.row}>
        <div className="min-w-0">
          <p className="font-red-hat text-xs font-semibold uppercase tracking-[0.22em] text-moss/55 dark:text-sage/60">
            MHacks Organizer
          </p>
          <h1 className={classes.title}>{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
          <AdminHeaderActions />
        </div>
      </div>
      {footer}
    </header>
  );
}
