"use client";

import Link from "next/link";
import { LayoutGridIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "./theme-toggle";

/**
 * The way back out of a tool. Points at /dashboard rather than /admin: the
 * admin index no longer renders a hub, so the dashboard's "Organizer tools"
 * section is the real landing surface. The active-page styling went with it —
 * this never links to the page it is on.
 */
export function AdminHeaderActions() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm" className="bg-card">
        <Link href="/dashboard">
          <LayoutGridIcon className="size-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
      </Button>
      <ThemeToggle />
    </div>
  );
}
