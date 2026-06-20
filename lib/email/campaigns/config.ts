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
const defaultMaxSendRatePerSecond = 14;

export function assertCampaignsEnabled() {
  if (process.env.ENABLE_EMAIL_CAMPAIGNS !== "true") {
    throw new EmailCampaignError("Email campaigns are disabled", 404);
  }
}

export function assertFullCampaignSendingAllowed() {
  assertCampaignsEnabled();

  if (
    process.env.NODE_ENV === "production" &&
    process.env.EMAIL_CAMPAIGN_ALLOW_FULL_SENDS !== "true"
  ) {
    throw new EmailCampaignError(
      "Full list sending is disabled for this environment",
      403,
    );
  }
}

export function getCampaignLimits() {
  const maxSendRate = readPositiveInt(
    "EMAIL_CAMPAIGN_MAX_SEND_RATE_PER_SECOND",
    defaultMaxSendRatePerSecond,
  );
  const minimumDelayMs = Math.ceil(1000 / maxSendRate);

  return {
    maxRecipients: Math.min(
      readPositiveInt("EMAIL_CAMPAIGN_MAX_RECIPIENTS", hardMaxRecipients),
      hardMaxRecipients,
    ),
    batchSize: Math.min(
      readPositiveInt("EMAIL_CAMPAIGN_BATCH_SIZE", hardMaxBatchSize),
      hardMaxBatchSize,
    ),
    sendDelayMs: Math.max(
      readPositiveInt("EMAIL_CAMPAIGN_SEND_DELAY_MS", 100),
      minimumDelayMs,
    ),
    maxSendRatePerSecond: maxSendRate,
  };
}

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
