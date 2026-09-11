import {
  deliverBroadcastEmail,
  renderBroadcastEmail,
} from "@/lib/broadcast/targets/email-shared";
import type { BroadcastTarget } from "@/lib/broadcast/types";
import { requiredEmailCampaignTestRecipients } from "@/lib/email/campaigns/constants";

const testRecipientEmails = requiredEmailCampaignTestRecipients.map(
  (recipient) => recipient.email.trim().toLowerCase(),
);

export const organizerTestEmailTarget: BroadcastTarget = {
  id: "email:organizer-test",
  label: "Organizer Test Emails",
  countRecipients,
  resolveRecipients,
  renderMessage: renderBroadcastEmail,
  deliver: deliverBroadcastEmail,
};

async function countRecipients() {
  return testRecipientEmails.length;
}

async function resolveRecipients() {
  return [...testRecipientEmails];
}
