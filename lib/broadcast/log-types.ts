import type { BroadcastFailure } from "@/lib/broadcast/types";

export const BROADCAST_LOGS_PAGE_SIZE = 25;

export type BroadcastLogListItem = {
  id: string;
  target: string;
  subject: string;
  body: string;
  sentAt: Date;
  status: string;
  failedCount: number;
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
