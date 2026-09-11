import { getBroadcastTarget } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import type { BroadcastLogListItem } from "@/lib/broadcast/log-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BroadcastRecipientsExport } from "./BroadcastRecipientsExport";

function targetLabel(targetId: string) {
  try {
    return getBroadcastTarget(targetId).label;
  } catch {
    return targetId;
  }
}

export function BroadcastLogsTable({ logs }: { logs: BroadcastLogListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Body</TableHead>
          <TableHead>Delivery</TableHead>
          <TableHead>Recipients</TableHead>
          <TableHead>Operator</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => {
          const sentCount = log.deliveredTo?.length ?? 0;
          const totalCount = log.recipients?.length ?? sentCount;
          const deliveryLabel =
            log.status === "sending"
              ? `${sentCount}/${totalCount} sent, ${log.failedCount} failed (in progress)`
              : `${sentCount} sent, ${log.failedCount} failed`;

          return (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(log.sentAt).toLocaleString()}
              </TableCell>
              <TableCell>{targetLabel(log.target)}</TableCell>
              <TableCell>{log.subject}</TableCell>
              <TableCell className="max-w-xs truncate">{log.body}</TableCell>
              <TableCell>{deliveryLabel}</TableCell>
              <TableCell>
                <BroadcastRecipientsExport
                  broadcastId={log.id}
                  deliveredCount={sentCount}
                />
              </TableCell>
              <TableCell>{log.operatorEmail ?? "—"}</TableCell>
            </TableRow>
          );
        })}
        {logs.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-center text-muted-foreground"
            >
              No broadcasts yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
