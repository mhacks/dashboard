import { cache } from "react";
import { requireOrganizer } from "@/lib/auth/guards";
import { EmailCampaignError } from "@/lib/email/campaigns/config";
import { hackerEmailTarget } from "@/lib/broadcast/targets/email-hacker";
import { organizerTestEmailTarget } from "@/lib/broadcast/targets/email-organizer-test";
import type {
  BroadcastTarget,
  BroadcastTargetSummary,
} from "@/lib/broadcast/types";

const targets = new Map<string, BroadcastTarget>([
  [hackerEmailTarget.id, hackerEmailTarget],
  [organizerTestEmailTarget.id, organizerTestEmailTarget],
]);

export function getBroadcastTarget(id: string): BroadcastTarget {
  const target = targets.get(id);

  if (!target) {
    throw new EmailCampaignError(`Unknown broadcast target: ${id}`, 400);
  }

  return target;
}

export const listBroadcastTargetSummaries = cache(
  async (): Promise<BroadcastTargetSummary[]> => {
    await requireOrganizer();

    return Promise.all(
      Array.from(targets.values()).map(async (target) => ({
        id: target.id,
        label: target.label,
        recipientCount: await target.countRecipients(),
      })),
    );
  },
);
