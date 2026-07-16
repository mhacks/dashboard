"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGridIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ThemeToggle from "./theme-toggle";

export function AdminHeaderActions() {
  const pathname = usePathname();
  const onAdminHome = pathname === "/admin";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Button
        asChild
        variant={onAdminHome ? "default" : "outline"}
        size="sm"
        className={cn(!onAdminHome && "bg-card")}
      >
        <Link href="/admin" aria-current={onAdminHome ? "page" : undefined}>
          <LayoutGridIcon className="size-4" />
          <span className="hidden sm:inline">Admin Home</span>
        </Link>
      </Button>
      <ThemeToggle />
    </div>
  );
}
