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
const staleSendingLeaseMs = 30 * 60 * 1000;

export const emailCampaignSender = {
  fromName: "MHacks Team",
  fromEmail: "hackathon@mhacks.org",
} as const;

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
