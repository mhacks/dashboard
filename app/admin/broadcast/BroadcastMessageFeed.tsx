import type { BroadcastLogListItem } from "@/lib/broadcast/log-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BroadcastDeliveryDetailsButton } from "./BroadcastDeliveryDetails";

function targetLabel(targetId: string, targetLabels: Record<string, string>) {
  return targetLabels[targetId] ?? targetId;
}

function operatorInitials(email: string | null) {
  if (!email) {
    return "?";
  }

  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
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

function deliveryLabel(log: BroadcastLogListItem) {
  const sentCount = log.deliveredTo?.length ?? 0;
  const totalCount = log.recipients?.length ?? sentCount;

  if (log.status === "sending") {
    return `${sentCount}/${totalCount} sent, ${log.failedCount} failed (in progress)`;
  }

  return `${sentCount} sent, ${log.failedCount} failed`;
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
    <div className="flex flex-col">
      {logs.map((log, index) => {
        const previousLog = logs[index - 1];
        const showDayDivider =
          !previousLog || dayKey(previousLog.sentAt) !== dayKey(log.sentAt);

        return (
          <div key={log.id}>
            {showDayDivider ? (
              <div className="relative py-2">
                <div className="absolute inset-x-0 top-1/2 border-t" />
                <p className="relative mx-auto w-fit bg-background px-2 text-[11px] font-medium text-muted-foreground">
                  {formatDayLabel(log.sentAt)}
                </p>
              </div>
            ) : null}

            <article className="group flex gap-2 px-1 py-0.5 hover:bg-muted/40">
              <Avatar size="sm" className="mt-0.5 size-7">
                <AvatarFallback className="text-[10px]">
                  {operatorInitials(log.operatorEmail)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="text-sm font-medium leading-none">
                    {log.operatorEmail ?? "Unknown operator"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatMessageTime(log.sentAt)}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-4 px-1.5 text-[10px] font-normal"
                  >
                    {targetLabel(log.target, targetLabels)}
                  </Badge>
                  {log.status === "sending" ? (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1.5 text-[10px] font-normal"
                    >
                      Sending
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-0.5 text-sm font-medium leading-snug">
                  {log.subject}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-foreground/90">
                  {log.body}
                </p>

                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                  <span>{deliveryLabel(log)}</span>
                  <span aria-hidden="true">·</span>
                  <BroadcastDeliveryDetailsButton broadcastId={log.id} />
                </p>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
