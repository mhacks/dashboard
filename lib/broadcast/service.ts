import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import {
  BROADCAST_BODY_LIMIT,
  BROADCAST_SUBJECT_LIMIT,
} from "@/lib/broadcast/config";
import { getBroadcastTarget } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import type { BroadcastSendStatus } from "@/lib/broadcast/types";
import { db } from "@/lib/db";
import {
  broadcastLogs,
  type BroadcastLogRow,
} from "@/lib/db/schema/broadcasts";
import {
  EmailCampaignError,
  getCampaignLimits,
} from "@/lib/email/campaigns/config";

export const broadcastStartSchema = z.object({
  target: z.string().trim().min(1),
  subject: z.string().trim().min(1).max(BROADCAST_SUBJECT_LIMIT),
  body: z.string().trim().min(1).max(BROADCAST_BODY_LIMIT),
});

export const broadcastBatchSchema = z.object({
  broadcastId: z.string().uuid(),
  cursor: z.number().int().min(0).default(0),
});

export async function startBroadcast(input: unknown) {
  const organizer = await requireOrganizer();
  const body = broadcastStartSchema.parse(input);
  const target = getBroadcastTarget(body.target);
  const recipients = await target.resolveRecipients();

  if (recipients.length === 0) {
    throw new EmailCampaignError(
      `No recipients found for ${target.label}`,
      400,
    );
  }

  const [broadcast] = await db
    .insert(broadcastLogs)
    .values({
      target: target.id,
      subject: body.subject,
      body: body.body,
      sentBy: organizer.id,
      status: "sending",
      recipients,
      deliveredTo: [],
      failedCount: 0,
      nextCursor: 0,
      recentFailures: [],
    })
    .returning();

  if (!broadcast) {
    throw new EmailCampaignError("Could not create broadcast", 500);
  }

  return {
    broadcastId: broadcast.id,
    totalRecipients: recipients.length,
    status: buildBroadcastStatus(broadcast),
  };
}

export async function sendBroadcastBatch(input: unknown) {
  await requireOrganizer();
  const body = broadcastBatchSchema.parse(input);
  const limits = getCampaignLimits();

  const [broadcast] = await db
    .select()
    .from(broadcastLogs)
    .where(eq(broadcastLogs.id, body.broadcastId))
    .limit(1);

  if (!broadcast) {
    throw new EmailCampaignError("Broadcast not found", 404);
  }

  if (broadcast.status === "complete") {
    return buildBroadcastStatus(broadcast);
  }

  if (body.cursor !== broadcast.nextCursor) {
    return buildBroadcastStatus(broadcast);
  }

  const target = getBroadcastTarget(broadcast.target);
  const recipients = broadcast.recipients ?? [];
  const batchEnd = Math.min(
    broadcast.nextCursor + limits.batchSize,
    recipients.length,
  );
  const batch = recipients.slice(broadcast.nextCursor, batchEnd);
  const message = {
    subject: broadcast.subject,
    body: broadcast.body,
  };

  let failedCount = broadcast.failedCount;
  let nextCursor = broadcast.nextCursor;
  const deliveredTo = [...(broadcast.deliveredTo ?? [])];
  const recentFailures = [...(broadcast.recentFailures ?? [])];

  for (const recipient of batch) {
    const result = await target.deliver(message, recipient);

    if (result.status === "sent") {
      deliveredTo.push(recipient);
    } else {
      failedCount += 1;
      recentFailures.push({
        recipient,
        error: result.error ?? "Unknown delivery error",
      });
    }

    nextCursor += 1;
    await sleep(limits.sendDelayMs);
  }

  const complete = nextCursor >= recipients.length;
  const trimmedFailures = recentFailures.slice(-10);

  const [updated] = await db
    .update(broadcastLogs)
    .set({
      deliveredTo,
      failedCount,
      nextCursor,
      recentFailures: trimmedFailures,
      status: complete ? "complete" : "sending",
    })
    .where(
      and(
        eq(broadcastLogs.id, broadcast.id),
        eq(broadcastLogs.nextCursor, broadcast.nextCursor),
      ),
    )
    .returning();

  if (!updated) {
    const [latest] = await db
      .select()
      .from(broadcastLogs)
      .where(eq(broadcastLogs.id, broadcast.id))
      .limit(1);

    if (!latest) {
      throw new EmailCampaignError("Broadcast not found", 404);
    }

    return buildBroadcastStatus(latest);
  }

  return buildBroadcastStatus(updated);
}

export async function findActiveBroadcast() {
  const organizer = await requireOrganizer();

  const [broadcast] = await db
    .select()
    .from(broadcastLogs)
    .where(
      and(
        eq(broadcastLogs.sentBy, organizer.id),
        eq(broadcastLogs.status, "sending"),
      ),
    )
    .orderBy(desc(broadcastLogs.sentAt))
    .limit(1);

  return broadcast ? buildBroadcastStatus(broadcast) : null;
}

function buildBroadcastStatus(broadcast: BroadcastLogRow): BroadcastSendStatus {
  const totalRecipients = broadcast.recipients?.length ?? 0;
  const sentCount = broadcast.deliveredTo?.length ?? 0;
  const failedCount = broadcast.failedCount;
  const complete = broadcast.status === "complete";
  const pendingCount = complete
    ? 0
    : Math.max(0, totalRecipients - sentCount - failedCount);

  return {
    broadcastId: broadcast.id,
    target: broadcast.target,
    totalRecipients,
    sentCount,
    failedCount,
    pendingCount,
    nextCursor: broadcast.nextCursor,
    complete,
    recentFailures: broadcast.recentFailures ?? [],
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
