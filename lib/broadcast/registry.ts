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

export async function listBroadcastTargetSummaries(): Promise<
  BroadcastTargetSummary[]
> {
  const summaries: BroadcastTargetSummary[] = [];

  for (const target of listBroadcastTargets()) {
    summaries.push({
      id: target.id,
      label: target.label,
      description: target.description,
      recipientCount: await target.countRecipients(),
    });
  }

  return summaries;
}
