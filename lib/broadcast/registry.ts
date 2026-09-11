import { cache } from "react";
import { requireOrganizer } from "@/lib/auth/guards";
import { EmailCampaignError } from "@/lib/email/campaigns/config";
import type {
  BroadcastTarget,
  BroadcastTargetSummary,
} from "@/lib/broadcast/types";

const targets = new Map<string, BroadcastTarget>();

export function registerBroadcastTarget(target: BroadcastTarget) {
  targets.set(target.id, target);
}

export function getBroadcastTarget(id: string): BroadcastTarget {
  const target = targets.get(id);

  if (!target) {
    throw new EmailCampaignError(`Unknown broadcast target: ${id}`, 400);
  }

  return target;
}

export function listBroadcastTargets(): BroadcastTarget[] {
  return Array.from(targets.values());
}

export const listBroadcastTargetSummaries = cache(
  async (): Promise<BroadcastTargetSummary[]> => {
    await requireOrganizer();

    return Promise.all(
      listBroadcastTargets().map(async (target) => ({
        id: target.id,
        label: target.label,
        recipientCount: await target.countRecipients(),
      })),
    );
  },
);
