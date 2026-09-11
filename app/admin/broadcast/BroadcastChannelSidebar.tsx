"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HashIcon } from "lucide-react";
import { getBroadcastChannelPath } from "@/lib/broadcast/channels";
import type { BroadcastTargetSummary } from "@/lib/broadcast/types";
import { cn } from "@/lib/utils";

function channelLabel(label: string) {
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function BroadcastChannelSidebar({
  targets,
}: {
  targets: BroadcastTargetSummary[];
}) {
  const pathname = usePathname();
  const globalActive = pathname === "/admin/broadcast";

  return (
    <nav
      aria-label="Broadcast channels"
      className="hidden w-44 min-h-0 shrink-0 flex-col gap-0.5 overflow-y-auto border-r pr-3 pt-1 md:flex"
    >
      <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Channels
      </p>

      <Link
        href="/admin/broadcast"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          globalActive
            ? "bg-primary/10 font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <HashIcon className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate">Global</span>
      </Link>

      {targets.map((target) => {
        const href = getBroadcastChannelPath(target.id);
        const active = pathname === href;

        return (
          <Link
            key={target.id}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <HashIcon className="size-3.5 shrink-0 opacity-70" />
            <span className="truncate">{channelLabel(target.label)}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {target.recipientCount}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function BroadcastChannelMobileNav({
  targets,
  activeTargetId,
}: {
  targets: BroadcastTargetSummary[];
  activeTargetId: string | null;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Broadcast channels"
      className="flex gap-1.5 overflow-x-auto pb-1 md:hidden"
    >
      <Link
        href="/admin/broadcast"
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
          pathname === "/admin/broadcast"
            ? "border-primary/40 bg-primary/5 text-foreground"
            : "border-border text-muted-foreground",
        )}
      >
        <HashIcon className="size-3" />
        Global
      </Link>

      {targets.map((target) => {
        const href = getBroadcastChannelPath(target.id);

        return (
          <Link
            key={target.id}
            href={href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              activeTargetId === target.id
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            <HashIcon className="size-3" />
            {channelLabel(target.label)}
          </Link>
        );
      })}
    </nav>
  );
}
