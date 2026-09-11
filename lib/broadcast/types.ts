export type BroadcastMessage = {
  subject: string;
  body: string;
};

export type BroadcastDeliveryResult = {
  recipient: string;
  status: "sent" | "failed";
  reference: string | null;
  error: string | null;
};

export type BroadcastFailure = {
  recipient: string;
  error: string;
};

export type BroadcastSendStatus = {
  broadcastId: string;
  target: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  nextCursor: number;
  complete: boolean;
  recentFailures: BroadcastFailure[];
};

export type BroadcastTargetSummary = {
  id: string;
  label: string;
  description: string;
  recipientCount: number;
};

export interface BroadcastTarget {
  id: string;
  label: string;
  description: string;
  countRecipients(): Promise<number>;
  resolveRecipients(): Promise<string[]>;
  deliver(
    message: BroadcastMessage,
    recipient: string,
  ): Promise<BroadcastDeliveryResult>;
}
