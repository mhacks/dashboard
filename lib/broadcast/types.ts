export type BroadcastMessage = {
  subject: string;
  body: string;
};

export type BroadcastRenderedMessage = {
  subject: string;
  text: string;
  html: string;
};

export type BroadcastDeliveryResult = {
  status: "sent" | "failed";
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
};

export type BroadcastTargetSummary = {
  id: string;
  label: string;
  recipientCount: number;
};

export interface BroadcastTarget {
  id: string;
  label: string;
  countRecipients(): Promise<number>;
  resolveRecipients(): Promise<string[]>;
  renderMessage(message: BroadcastMessage): BroadcastRenderedMessage;
  deliver(
    message: BroadcastRenderedMessage,
    recipient: string,
  ): Promise<BroadcastDeliveryResult>;
}
