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

  const [activeBroadcast] = await db
    .select({ id: broadcastLogs.id })
    .from(broadcastLogs)
    .where(
      and(
        eq(broadcastLogs.sentBy, organizer.id),
        eq(broadcastLogs.status, "sending"),
      ),
    )
    .limit(1);

  if (activeBroadcast) {
    throw new EmailCampaignError(
      "You already have a broadcast in progress. Resume or wait for it to finish before starting another.",
      409,
    );
  }

  const [activeTargetBroadcast] = await db
    .select({ id: broadcastLogs.id })
    .from(broadcastLogs)
    .where(
      and(
        eq(broadcastLogs.target, target.id),
        eq(broadcastLogs.status, "sending"),
      ),
    )
    .limit(1);

  if (activeTargetBroadcast) {
    throw new EmailCampaignError(
      "Another broadcast is already in progress for this target. Wait for it to finish before starting another.",
      409,
    );
  }

  let broadcast: BroadcastLogRow | undefined;

  try {
    [broadcast] = await db
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
  } catch (error) {
    if (isActiveBroadcastConflict(error)) {
      throw new EmailCampaignError(
        "Another broadcast is already in progress for this target. Wait for it to finish before starting another.",
        409,
      );
    }

    throw error;
  }

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
  const organizer = await requireOrganizer();
  const body = broadcastBatchSchema.parse(input);
  const limits = getCampaignLimits();

  const [broadcast] = await db
    .select()
    .from(broadcastLogs)
    .where(eq(broadcastLogs.id, body.broadcastId))
    .limit(1);

  if (!broadcast || broadcast.sentBy !== organizer.id) {
    throw new EmailCampaignError("Broadcast not found", 404);
  }

  if (broadcast.status === "complete") {
    return buildBroadcastStatus(broadcast);
  }

  if (body.cursor !== broadcast.nextCursor) {
    return buildBroadcastStatus(broadcast);
  }

  const target = getBroadcastTarget(broadcast.target);
  const message = {
    subject: broadcast.subject,
    body: broadcast.body,
  };

  for (let index = 0; index < limits.batchSize; index += 1) {
    const claim = await claimNextBroadcastRecipient(
      broadcast.id,
      index === 0 ? body.cursor : undefined,
    );

    if (claim.kind !== "claimed") {
      break;
    }

    const result = await target.deliver(message, claim.recipient);
    await recordBroadcastDelivery(broadcast.id, claim.recipient, result);
    await sleep(limits.sendDelayMs);
  }

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

type BroadcastRecipientClaim =
  | { kind: "claimed"; recipient: string }
  | { kind: "misaligned" }
  | { kind: "complete" };

async function claimNextBroadcastRecipient(
  broadcastId: string,
  expectedCursor?: number,
): Promise<BroadcastRecipientClaim> {
  return db.transaction(async (tx) => {
    const [broadcast] = await tx
      .select()
      .from(broadcastLogs)
      .where(eq(broadcastLogs.id, broadcastId))
      .limit(1)
      .for("update");

    if (!broadcast || broadcast.status !== "sending") {
      return { kind: "complete" };
    }

    const recipients = broadcast.recipients ?? [];

    if (
      expectedCursor !== undefined &&
      broadcast.nextCursor !== expectedCursor
    ) {
      return { kind: "misaligned" };
    }

    if (broadcast.processingRecipient) {
      return { kind: "claimed", recipient: broadcast.processingRecipient };
    }

    if (broadcast.nextCursor >= recipients.length) {
      await finalizeBroadcastIfComplete(tx, broadcast);
      return { kind: "complete" };
    }

    const recipient = recipients[broadcast.nextCursor];

    await tx
      .update(broadcastLogs)
      .set({ processingRecipient: recipient })
      .where(eq(broadcastLogs.id, broadcastId));

    return { kind: "claimed", recipient };
  });
}

async function recordBroadcastDelivery(
  broadcastId: string,
  recipient: string,
  result: { status: "sent" | "failed"; error?: string | null },
) {
  await db.transaction(async (tx) => {
    const [broadcast] = await tx
      .select()
      .from(broadcastLogs)
      .where(eq(broadcastLogs.id, broadcastId))
      .limit(1)
      .for("update");

    if (!broadcast || broadcast.processingRecipient !== recipient) {
      return;
    }

    const recipients = broadcast.recipients ?? [];
    const nextCursor = broadcast.nextCursor + 1;
    const complete = nextCursor >= recipients.length;
    const baseUpdate = {
      nextCursor,
      processingRecipient: null,
      status: complete ? "complete" : "sending",
    };

    if (result.status === "sent") {
      await tx
        .update(broadcastLogs)
        .set({
          ...baseUpdate,
          deliveredTo: [...(broadcast.deliveredTo ?? []), recipient],
        })
        .where(eq(broadcastLogs.id, broadcastId));
      return;
    }

    const recentFailures = [
      ...(broadcast.recentFailures ?? []),
      {
        recipient,
        error: result.error ?? "Unknown delivery error",
      },
    ];

    await tx
      .update(broadcastLogs)
      .set({
        ...baseUpdate,
        failedCount: broadcast.failedCount + 1,
        recentFailures: recentFailures.slice(-10),
      })
      .where(eq(broadcastLogs.id, broadcastId));
  });
}

async function finalizeBroadcastIfComplete(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  broadcast: BroadcastLogRow,
) {
  const recipients = broadcast.recipients ?? [];
  const accounted =
    (broadcast.deliveredTo?.length ?? 0) + broadcast.failedCount;

  if (
    broadcast.status === "complete" ||
    broadcast.nextCursor < recipients.length ||
    accounted < recipients.length
  ) {
    return;
  }

  await tx
    .update(broadcastLogs)
    .set({ status: "complete", processingRecipient: null })
    .where(eq(broadcastLogs.id, broadcast.id));
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

function isActiveBroadcastConflict(error: unknown) {
  const wrapped = error as { code?: string; cause?: { code?: string } };
  return (wrapped.code ?? wrapped.cause?.code) === "23505";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
