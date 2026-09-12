import type { BroadcastLogListItem } from "@/lib/broadcast/log-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExternalLinkIcon } from "lucide-react";
import { BroadcastDeliveryDetails } from "./BroadcastDeliveryDetails";

function DeliveryDetailsBadge({
  broadcastId,
  label,
  variant = "outline",
  className,
}: {
  broadcastId: string;
  label: string;
  variant?: "destructive" | "outline" | "secondary";
  className?: string;
}) {
  return (
    <BroadcastDeliveryDetails broadcastId={broadcastId}>
      <Badge
        variant={variant}
        className={cn("h-5 gap-1 px-2 text-[11px] font-normal", className)}
      >
        {label}
        <ExternalLinkIcon className="size-3" aria-hidden="true" />
      </Badge>
    </BroadcastDeliveryDetails>
  );
}

function targetLabel(targetId: string, targetLabels: Record<string, string>) {
  return targetLabels[targetId] ?? targetId;
}

function operatorInitials(email: string | null) {
  if (!email) {
    return "?";
  }

  const local = email.split("@")[0];
  const parts = local.split(/[._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return local.slice(0, 2).toUpperCase();
}

function formatMessageTime(value: Date) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayLabel(value: Date) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayKey(value: Date) {
  return new Date(value).toDateString();
}

export function BroadcastMessageFeed({
  logs,
  targetLabels,
  emptyMessage = "No broadcasts yet. Send the first message below.",
}: {
  logs: BroadcastLogListItem[];
  targetLabels: Record<string, string>;
  emptyMessage?: string;
}) {
  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {logs.map((log, index) => {
        const previousLog = logs[index - 1];
        const showDayDivider =
          !previousLog || dayKey(previousLog.sentAt) !== dayKey(log.sentAt);

        return (
          <div key={log.id}>
            {showDayDivider ? (
              <div className="relative py-4">
                <div className="absolute inset-x-0 top-1/2 border-t" />
                <p className="relative mx-auto w-fit bg-background px-3 text-xs font-medium text-muted-foreground">
                  {formatDayLabel(log.sentAt)}
                </p>
              </div>
            ) : null}

            <article className="group flex gap-3 rounded-md px-2 py-2.5 hover:bg-muted/40">
              <Avatar size="sm" className="mt-0.5 size-8">
                <AvatarFallback className="text-[11px]">
                  {operatorInitials(log.operatorEmail)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-medium leading-normal">
                    {log.operatorEmail ?? "Unknown operator"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatMessageTime(log.sentAt)}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-5 px-2 text-[11px] font-normal"
                  >
                    {targetLabel(log.target, targetLabels)}
                  </Badge>
                  {log.status === "sending" ? (
                    <DeliveryDetailsBadge
                      broadcastId={log.id}
                      label="In progress"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400"
                    />
                  ) : (
                    <DeliveryDetailsBadge
                      broadcastId={log.id}
                      label={log.retryFailedCount > 0 ? "Failed" : "Details"}
                      variant={
                        log.retryFailedCount > 0 ? "destructive" : "outline"
                      }
                      className={
                        log.retryFailedCount > 0
                          ? undefined
                          : "hidden group-hover:inline-flex"
                      }
                    />
                  )}
                </div>

                <p className="mt-1.5 text-sm font-medium leading-snug">
                  {log.subject}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {log.body}
                </p>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
