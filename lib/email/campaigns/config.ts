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

export const emailCampaignSender = {
  fromName: "MHacks Team",
  fromEmail: "hackathon@mhacks.org",
} as const;

export const emailCampaignLimits = {
  maxRecipients: hardMaxRecipients,
  batchSize: hardMaxBatchSize,
  sendDelayMs: 100,
  maxSendRatePerSecond: 14,
} as const;

const allowFullCampaignSendsInProduction = false;

export function assertFullCampaignSendingAllowed() {
  if (
    process.env.NODE_ENV === "production" &&
    !allowFullCampaignSendsInProduction
  ) {
    throw new EmailCampaignError(
      "Full list sending is disabled for this environment",
      403,
    );
  }
}

export function getCampaignLimits() {
  return emailCampaignLimits;
}
