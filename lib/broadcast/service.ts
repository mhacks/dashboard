import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
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

  await expireStaleBroadcasts(target.id);

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
        leaseExpiresAt: broadcastLeaseExpiry(),
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

  if (broadcast.status === "expired") {
    throw new EmailCampaignError(
      "This broadcast expired and can no longer be resumed.",
      409,
    );
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

export async function exportBroadcastRecipients(broadcastId: string) {
  await requireOrganizer();

  const [log] = await db
    .select({ deliveredTo: broadcastLogs.deliveredTo })
    .from(broadcastLogs)
    .where(eq(broadcastLogs.id, broadcastId))
    .limit(1);

  if (!log) {
    throw new EmailCampaignError("Broadcast not found", 404);
  }

  return {
    filename: `broadcast-${broadcastId}-recipients.txt`,
    content: (log.deliveredTo ?? []).join("\n"),
  };
}

export async function findActiveBroadcast() {
  const organizer = await requireOrganizer();

  // Resume is a read path: a lapsed lease only means the prior tab lost its
  // claim, not that the broadcast is abandoned. Expiring here would mark the
  // row dead on reload and block sendBroadcastBatch from continuing it.
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
      if (broadcastLeaseIsActive(broadcast)) {
        return { kind: "misaligned" };
      }

      const leaseToken = randomUUID();

      await tx
        .update(broadcastLogs)
        .set({
          leaseToken,
          leaseExpiresAt: broadcastLeaseExpiry(),
        })
        .where(eq(broadcastLogs.id, broadcastId));

      return { kind: "claimed", recipient: broadcast.processingRecipient };
    }

    if (broadcast.nextCursor >= recipients.length) {
      await finalizeBroadcastIfComplete(tx, broadcast);
      return { kind: "complete" };
    }

    const recipient = recipients[broadcast.nextCursor];
    const leaseToken = randomUUID();

    await tx
      .update(broadcastLogs)
      .set({
        processingRecipient: recipient,
        leaseToken,
        leaseExpiresAt: broadcastLeaseExpiry(),
      })
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
      leaseToken: null,
      leaseExpiresAt: complete ? null : broadcastLeaseExpiry(),
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
    .set({
      status: "complete",
      processingRecipient: null,
      leaseToken: null,
      leaseExpiresAt: null,
    })
    .where(eq(broadcastLogs.id, broadcast.id));
}

async function expireStaleBroadcasts(target?: string) {
  const now = new Date().toISOString();
  const conditions = [
    eq(broadcastLogs.status, "sending"),
    or(
      isNull(broadcastLogs.leaseExpiresAt),
      lt(broadcastLogs.leaseExpiresAt, now),
    ),
  ];

  if (target) {
    conditions.push(eq(broadcastLogs.target, target));
  }

  await db
    .update(broadcastLogs)
    .set({
      status: "expired",
      processingRecipient: null,
      leaseToken: null,
      leaseExpiresAt: null,
    })
    .where(and(...conditions));
}

function broadcastLeaseIsActive(broadcast: BroadcastLogRow) {
  return Boolean(
    broadcast.leaseToken &&
    broadcast.leaseExpiresAt &&
    Date.parse(broadcast.leaseExpiresAt) > Date.now(),
  );
}

function broadcastLeaseExpiry() {
  return new Date(
    Date.now() + getCampaignLimits().staleSendingLeaseMs,
  ).toISOString();
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
