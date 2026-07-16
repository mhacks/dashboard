"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminHeaderActions } from "./admin-header-actions";

export function AdminPageHeader({
  title,
  description,
  variant = "page",
  footer,
}: {
  title: string;
  description?: string;
  variant?: "page" | "workspace";
  footer?: ReactNode;
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
        <div className="min-w-0">
          <p className="font-red-hat text-xs font-semibold uppercase tracking-[0.22em] text-moss/55 dark:text-sage/60">
            MHacks Organizer
          </p>
          <h1
            className={cn(
              "font-heading italic tracking-tight text-moss dark:text-sage",
              isWorkspace ? "text-2xl sm:text-3xl" : "text-4xl",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <AdminHeaderActions />
      </div>
      {footer}
    </header>
  );
}
