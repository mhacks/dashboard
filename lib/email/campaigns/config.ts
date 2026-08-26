export class EmailCampaignError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const hardMaxRecipients = 2000;
const hardMaxBatchSize = 25;
const staleSendingLeaseMs = 5 * 60 * 1000;

export const emailCampaignLimits = {
  maxRecipients: hardMaxRecipients,
  batchSize: hardMaxBatchSize,
  sendDelayMs: 100,
  maxSendRatePerSecond: 14,
  staleSendingLeaseMs,
} as const;

export function getCampaignLimits() {
  return emailCampaignLimits;
}
