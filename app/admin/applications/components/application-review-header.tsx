"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ADMIN_NAV_ITEMS } from "@/lib/admin/sections";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/app/admin/components/theme-toggle";

function ApplicationReviewNav() {
  const pathname = usePathname();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = item.isActive(pathname);
        const Icon = item.icon;

        return (
          <Button
            key={item.href}
            asChild
            variant={active ? "default" : "outline"}
            size="sm"
            className={cn(!active && "bg-card")}
          >
            <Link href={item.href} aria-current={active ? "page" : undefined}>
              <Icon className="size-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          </Button>
        );
      })}
      <ThemeToggle />
    </div>
  );
}

export function ApplicationReviewHeader({
  title,
  description,
  variant = "dashboard",
  footer,
}: {
  title: string;
  description?: string;
  variant?: "workspace" | "dashboard";
  footer?: ReactNode;
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
        <ApplicationReviewNav />
      </div>
      {footer}
    </header>
  );
}
