import type { BroadcastFailure } from "@/lib/broadcast/types";
import type { BroadcastLogRow } from "@/lib/db/schema/broadcasts";

export const BROADCAST_LOGS_PAGE_SIZE = 25;

export type BroadcastLogsFilter = {
  target?: string;
  search?: string;
};

export type BroadcastLogListItem = Pick<
  BroadcastLogRow,
  "id" | "target" | "subject" | "body" | "sentAt" | "status"
> & {
  retryFailedCount: number;
  operatorEmail: string | null;
};

export type BroadcastDeliveryDetails = {
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  deliveredTo: string[];
  retryFailures: BroadcastFailure[];
  omittedFailures: BroadcastFailure[];
};
