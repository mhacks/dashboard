export const BROADCAST_LOGS_PAGE_SIZE = 25;

export type BroadcastLogListItem = {
  id: string;
  target: string;
  subject: string;
  body: string;
  sentAt: Date;
  status: string;
  deliveredTo: string[] | null;
  recipients: string[] | null;
  failedCount: number;
  operatorEmail: string | null;
};
