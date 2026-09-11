"use client";

import { HashIcon } from "lucide-react";
import type { BroadcastTargetSummary } from "@/lib/broadcast/types";
import { cn } from "@/lib/utils";

function channelNavItems(targets: BroadcastTargetSummary[]) {
  return [
    { id: null, label: "Global", count: null as number | null },
    ...targets.map((target) => ({
      id: target.id,
      label: target.label,
      count: target.recipientCount,
    })),
  ];
}

export function BroadcastChannelSidebar({
  targets,
  activeTargetId,
  onSelect,
}: {
  targets: BroadcastTargetSummary[];
  activeTargetId: string | null;
  onSelect: (targetId: string | null) => void;
}) {
  const channels = channelNavItems(targets);

  return (
    <nav
      aria-label="Broadcast channels"
      className="hidden w-44 min-h-0 shrink-0 flex-col gap-0.5 overflow-y-auto border-r pr-3 pt-1 md:flex"
    >
      <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Channels
      </p>

      {channels.map((channel) => {
        const active = channel.id === activeTargetId;

        return (
          <button
            key={channel.id ?? "global"}
            type="button"
            onClick={() => onSelect(channel.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <HashIcon className="size-3.5 shrink-0 opacity-70" />
            <span className="truncate">{channel.label}</span>
            {channel.count !== null ? (
              <span className="ml-auto text-[10px] text-muted-foreground">
                {channel.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export function BroadcastChannelMobileNav({
  targets,
  activeTargetId,
  onSelect,
}: {
  targets: BroadcastTargetSummary[];
  activeTargetId: string | null;
  onSelect: (targetId: string | null) => void;
}) {
  const channels = channelNavItems(targets);

  return (
    <nav
      aria-label="Broadcast channels"
      className="flex gap-1.5 overflow-x-auto pb-1 md:hidden"
    >
      {channels.map((channel) => {
        const active = channel.id === activeTargetId;

        return (
          <button
            key={channel.id ?? "global"}
            type="button"
            onClick={() => onSelect(channel.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              active
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            <HashIcon className="size-3" />
            {channel.label}
          </button>
        );
      })}
    </nav>
  );
}
