import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import {
  BROADCAST_BODY_LIMIT,
  BROADCAST_SUBJECT_LIMIT,
} from "@/lib/broadcast/config";
import {
  buildBroadcastDeliveryDetails,
  categorizeBroadcastDeliveryFailures,
  mergeRetryResultsIntoOriginal,
} from "@/lib/broadcast/failures";
import { broadcastDeliveryProgress } from "@/lib/broadcast/progress";
import { getBroadcastTarget } from "@/lib/broadcast/registry";
import "@/lib/broadcast/targets";
import type {
  BroadcastDeliveryResult,
  BroadcastSendStatus,
} from "@/lib/broadcast/types";
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

export const broadcastRetrySchema = z.object({
  broadcastId: z.string().uuid(),
  recipients: z.array(z.string().trim().min(1)).min(1),
});

export const broadcastOmittedSchema = z.object({
  broadcastId: z.string().uuid(),
  omittedTo: z.array(z.string().trim().min(1)),
});

export const broadcastRetryResultsSchema = z.object({
  originalBroadcastId: z.string().uuid(),
  retryBroadcastId: z.string().uuid(),
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

  const broadcast = await createSendingBroadcast({
    target: target.id,
    subject: body.subject,
    body: body.body,
    sentBy: organizer.id,
    recipients,
    organizerInProgressMessage:
      "You already have a broadcast in progress. Resume or wait for it to finish before starting another.",
    targetInProgressMessage:
      "Another broadcast is already in progress for this target. Wait for it to finish before starting another.",
    failureMessage: "Could not create broadcast",
  });

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
  const broadcast = await getBroadcastLogForOrganizer(
    body.broadcastId,
    organizer.id,
  );

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
  const rendered = target.renderMessage({
    subject: broadcast.subject,
    body: broadcast.body,
  });

  for (let index = 0; index < limits.batchSize; index += 1) {
    const claim = await claimNextBroadcastRecipient(
      broadcast.id,
      index === 0 ? body.cursor : undefined,
    );

    if (claim.kind !== "claimed") {
      break;
    }

    const result = await target.deliver(rendered, claim.recipient);
    await recordBroadcastDelivery(broadcast.id, claim.recipient, result);
    await sleep(limits.sendDelayMs);
  }

  const latest = await getBroadcastLog(broadcast.id);
  return buildBroadcastStatus(latest);
}

export async function getBroadcastDeliveryDetails(broadcastId: string) {
  await requireOrganizer();
  const log = await getBroadcastLog(broadcastId);
  return buildBroadcastDeliveryDetails(log);
}

export async function updateBroadcastOmitted(input: unknown) {
  await requireOrganizer();
  const body = broadcastOmittedSchema.parse(input);

  const log = await getBroadcastLog(body.broadcastId);

  if (log.status !== "complete") {
    throw new EmailCampaignError(
      "Omitted recipients can only be updated on completed broadcasts.",
      409,
    );
  }

  const failureSet = new Set(
    categorizeBroadcastDeliveryFailures(log).failures.map(
      (failure) => failure.recipient,
    ),
  );
  const omittedTo = normalizeRecipientList(
    body.omittedTo,
    failureSet,
    (recipient) => `Recipient is not eligible to omit: ${recipient}`,
  );

  const [updated] = await db
    .update(broadcastLogs)
    .set({ omittedTo })
    .where(eq(broadcastLogs.id, body.broadcastId))
    .returning();

  if (!updated) {
    throw new EmailCampaignError("Broadcast not found", 404);
  }

  return buildBroadcastDeliveryDetails(updated);
}

export async function retryFailedBroadcast(input: unknown) {
  const organizer = await requireOrganizer();
  const body = broadcastRetrySchema.parse(input);

  const original = await getBroadcastLog(body.broadcastId);

  if (original.status !== "complete") {
    throw new EmailCampaignError(
      "Only completed broadcasts with failures can be retried.",
      409,
    );
  }

  const failedRecipientSet = new Set(
    categorizeBroadcastDeliveryFailures(original).retryFailures.map(
      (failure) => failure.recipient,
    ),
  );
  const failedRecipients = normalizeRecipientList(
    body.recipients,
    failedRecipientSet,
    (recipient) => `Recipient is not eligible for retry: ${recipient}`,
  );

  if (failedRecipients.length === 0) {
    throw new EmailCampaignError("No failed recipients to retry.", 400);
  }

  const broadcast = await createSendingBroadcast({
    target: original.target,
    subject: original.subject,
    body: original.body,
    sentBy: organizer.id,
    recipients: failedRecipients,
    organizerInProgressMessage:
      "You already have a broadcast in progress. Resume or wait for it to finish before retrying.",
    targetInProgressMessage:
      "Another broadcast is already in progress for this target. Wait for it to finish before retrying.",
    failureMessage: "Could not create retry broadcast",
  });

  return {
    broadcastId: broadcast.id,
    totalRecipients: failedRecipients.length,
    status: buildBroadcastStatus(broadcast),
  };
}

export async function applyBroadcastRetryResults(input: unknown) {
  const organizer = await requireOrganizer();
  const body = broadcastRetryResultsSchema.parse(input);

  const [original, retry] = await Promise.all([
    getBroadcastLogForOrganizer(body.originalBroadcastId, organizer.id),
    getBroadcastLogForOrganizer(body.retryBroadcastId, organizer.id, {
      notFoundMessage: "Retry broadcast not found",
    }),
  ]);

  if (retry.status !== "complete") {
    throw new EmailCampaignError("Retry broadcast is not complete yet.", 409);
  }

  const eligibleRecipients = new Set(
    categorizeBroadcastDeliveryFailures(original).retryFailures.map(
      (failure) => failure.recipient,
    ),
  );

  normalizeRecipientList(
    retry.recipients,
    eligibleRecipients,
    (recipient) => `Recipient is not eligible for retry merge: ${recipient}`,
  );

  const { deliveredTo, recentFailures, failedCount } =
    mergeRetryResultsIntoOriginal(original, retry);

  const [updated] = await db
    .update(broadcastLogs)
    .set({
      deliveredTo,
      recentFailures,
      failedCount,
    })
    .where(eq(broadcastLogs.id, original.id))
    .returning();

  if (!updated) {
    throw new EmailCampaignError("Broadcast not found", 404);
  }

  return buildBroadcastDeliveryDetails(updated);
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

    const recipients = broadcast.recipients;

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
  result: Pick<BroadcastDeliveryResult, "status" | "error">,
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

    const recipients = broadcast.recipients;
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
          deliveredTo: [...broadcast.deliveredTo, recipient],
        })
        .where(eq(broadcastLogs.id, broadcastId));
      return;
    }

    const recentFailures = [
      ...broadcast.recentFailures,
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
        recentFailures,
      })
      .where(eq(broadcastLogs.id, broadcastId));
  });
}

async function finalizeBroadcastIfComplete(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  broadcast: BroadcastLogRow,
) {
  const recipients = broadcast.recipients;
  const accounted = broadcast.deliveredTo.length + broadcast.failedCount;

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

async function getBroadcastLog(broadcastId: string) {
  const [log] = await db
    .select()
    .from(broadcastLogs)
    .where(eq(broadcastLogs.id, broadcastId))
    .limit(1);

  if (!log) {
    throw new EmailCampaignError("Broadcast not found", 404);
  }

  return log;
}

async function getBroadcastLogForOrganizer(
  broadcastId: string,
  organizerId: string,
  options?: { notFoundMessage?: string },
) {
  const log = await getBroadcastLog(broadcastId);

  if (log.sentBy !== organizerId) {
    throw new EmailCampaignError(
      options?.notFoundMessage ?? "Broadcast not found",
      404,
    );
  }

  return log;
}

function buildBroadcastStatus(broadcast: BroadcastLogRow): BroadcastSendStatus {
  const { totalRecipients, sentCount, failedCount, pendingCount, complete } =
    broadcastDeliveryProgress(broadcast);

  return {
    broadcastId: broadcast.id,
    target: broadcast.target,
    totalRecipients,
    sentCount,
    failedCount,
    pendingCount,
    nextCursor: broadcast.nextCursor,
    complete,
  };
}

async function assertNoActiveBroadcasts(
  organizerId: string,
  targetId: string,
  messages: {
    organizerInProgress: string;
    targetInProgress: string;
  },
) {
  const active = await db
    .select({
      sentBy: broadcastLogs.sentBy,
      target: broadcastLogs.target,
    })
    .from(broadcastLogs)
    .where(
      and(
        eq(broadcastLogs.status, "sending"),
        or(
          eq(broadcastLogs.sentBy, organizerId),
          eq(broadcastLogs.target, targetId),
        ),
      ),
    );

  if (active.some((broadcast) => broadcast.sentBy === organizerId)) {
    throw new EmailCampaignError(messages.organizerInProgress, 409);
  }

  if (active.some((broadcast) => broadcast.target === targetId)) {
    throw new EmailCampaignError(messages.targetInProgress, 409);
  }
}

async function createSendingBroadcast(input: {
  target: string;
  subject: string;
  body: string;
  sentBy: string;
  recipients: string[];
  organizerInProgressMessage: string;
  targetInProgressMessage: string;
  failureMessage: string;
}) {
  await expireStaleBroadcasts(input.target);
  await assertNoActiveBroadcasts(input.sentBy, input.target, {
    organizerInProgress: input.organizerInProgressMessage,
    targetInProgress: input.targetInProgressMessage,
  });

  try {
    const [broadcast] = await db
      .insert(broadcastLogs)
      .values({
        target: input.target,
        subject: input.subject,
        body: input.body,
        sentBy: input.sentBy,
        status: "sending",
        recipients: input.recipients,
        deliveredTo: [],
        omittedTo: [],
        failedCount: 0,
        nextCursor: 0,
        recentFailures: [],
        leaseExpiresAt: broadcastLeaseExpiry(),
      })
      .returning();

    if (!broadcast) {
      throw new EmailCampaignError(input.failureMessage, 500);
    }

    return broadcast;
  } catch (error) {
    if (isActiveBroadcastConflict(error)) {
      throw new EmailCampaignError(input.targetInProgressMessage, 409);
    }

    throw error;
  }
}

function normalizeRecipientList(
  recipients: string[],
  allowedSet: Set<string>,
  ineligibleMessage: (recipient: string) => string,
) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const recipient of recipients) {
    if (!allowedSet.has(recipient)) {
      throw new EmailCampaignError(ineligibleMessage(recipient), 400);
    }

    if (seen.has(recipient)) {
      continue;
    }

    seen.add(recipient);
    normalized.push(recipient);
  }

  return normalized;
}

function isActiveBroadcastConflict(error: unknown) {
  const wrapped = error as { code?: string; cause?: { code?: string } };
  return (wrapped.code ?? wrapped.cause?.code) === "23505";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
