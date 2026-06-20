import {
  assertCampaignsEnabled,
  EmailCampaignError,
  getCampaignLimits,
} from "@/lib/email/campaigns/config";
import { parseRecipientText } from "@/lib/email/campaigns/recipients";
import { getEmailTemplate } from "@/lib/email/templates/registry";
import {
  campaignUpsertSchema,
  type CampaignUpsertInput,
} from "@/lib/email/types";

export async function listCampaigns() {
  assertCampaignsEnabled();
  return [];
}

export async function createCampaign(input: CampaignUpsertInput) {
  assertCampaignsEnabled();
  validateCampaignInput(input);
  throwPersistenceUnavailable();
}

export async function getCampaign(_campaignId: string) {
  void _campaignId;
  assertCampaignsEnabled();
  throwPersistenceUnavailable();
}

export async function getCampaignDetails(campaignId: string) {
  await getCampaign(campaignId);
}

export async function updateCampaign(
  _campaignId: string,
  input: CampaignUpsertInput,
) {
  void _campaignId;
  assertCampaignsEnabled();
  validateCampaignInput(input);
  throwPersistenceUnavailable();
}

export async function deleteCampaign(_campaignId: string) {
  void _campaignId;
  assertCampaignsEnabled();
  throwPersistenceUnavailable();
}

export async function saveCampaignRecipients(
  _campaignId: string,
  recipientsText: string,
) {
  void _campaignId;
  assertCampaignsEnabled();
  const limits = getCampaignLimits();
  const parsed = parseRecipientText(recipientsText);

  if (parsed.emails.length > limits.maxRecipients) {
    throw new EmailCampaignError(
      `Recipient list exceeds ${limits.maxRecipients} addresses`,
      400,
    );
  }

  throwPersistenceUnavailable();
}

export async function renderCampaignPreview(
  _campaignId: string,
  _override?: Partial<CampaignUpsertInput>,
) {
  void _campaignId;
  void _override;
  assertCampaignsEnabled();
  throwPersistenceUnavailable();
}

export async function sendOneCampaignEmail(
  _campaignId: string,
  _email: string,
) {
  void _campaignId;
  void _email;
  assertCampaignsEnabled();
  throwPersistenceUnavailable();
}

export async function sendTestCampaignEmails(
  _campaignId: string,
  _emails: string[],
) {
  void _campaignId;
  void _emails;
  assertCampaignsEnabled();
  throwPersistenceUnavailable();
}

export async function processCampaignBatch(_campaignId: string) {
  void _campaignId;
  assertCampaignsEnabled();
  throwPersistenceUnavailable();
}

export async function retryFailedRecipients(_campaignId: string) {
  void _campaignId;
  assertCampaignsEnabled();
  throwPersistenceUnavailable();
}

export async function getCampaignStatus(_campaignId: string) {
  void _campaignId;
  assertCampaignsEnabled();
  throwPersistenceUnavailable();
}

function validateCampaignInput(input: CampaignUpsertInput) {
  const payload = campaignUpsertSchema.parse(input);
  const template = getEmailTemplate(payload.templateId);

  if (!template) {
    throw new EmailCampaignError("Unknown email template", 400);
  }

  return payload;
}

function throwPersistenceUnavailable(): never {
  throw new EmailCampaignError("Campaign persistence is unavailable", 409);
}
