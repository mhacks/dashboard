"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const warningSurfaceClass =
  "rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200";

export function InlineWarningNotice({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(warningSurfaceClass, "px-3 py-2", className)}>
      <div className="flex items-center gap-2 font-medium">
        <Icon className="size-4 shrink-0" />
        {title}
      </div>
      <div className="mt-1 text-xs">{children}</div>
    </div>
  );
}

export function WarningCallout({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cn(warningSurfaceClass, "p-4")}>
      <div className="flex items-start gap-2">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <div className="mt-1 text-amber-800/90 dark:text-amber-200/90">
            {children}
          </div>
          {actions ? (
            <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
