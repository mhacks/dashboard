import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth/guards";
import {
  BROADCAST_BODY_LIMIT,
  BROADCAST_MANUAL_FAILURE_ERROR,
  BROADCAST_SUBJECT_LIMIT,
} from "@/lib/broadcast/config";
import { categorizeBroadcastDeliveries } from "@/lib/broadcast/failures";
import type { BroadcastDeliveryDetails } from "@/lib/broadcast/log-types";
import { broadcastDeliveryProgress } from "@/lib/broadcast/progress";
import { getBroadcastTarget } from "@/lib/broadcast/registry";
import type {
  BroadcastDeliveryResult,
  BroadcastSendStatus,
} from "@/lib/broadcast/types";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import {
  broadcastDeliveries,
  broadcastLogs,
  type BroadcastLogRow,
} from "@/lib/db/schema/broadcasts";
import {
  EmailCampaignError,
  getCampaignLimits,
} from "@/lib/email/campaigns/config";
import { sleep } from "@/lib/utils";

const broadcastStartSchema = z.object({
  target: z.string().trim().min(1),
  subject: z.string().trim().min(1).max(BROADCAST_SUBJECT_LIMIT),
  body: z.string().trim().min(1).max(BROADCAST_BODY_LIMIT),
});

const broadcastBatchSchema = z.object({
  broadcastId: z.string().uuid(),
  cursor: z.number().int().min(0).default(0),
});

const broadcastRetrySchema = z.object({
  broadcastId: z.string().uuid(),
  recipients: z.array(z.string().trim().min(1)).min(1),
});

const broadcastOmittedSchema = z.object({
  broadcastId: z.string().uuid(),
  omittedTo: z.array(z.string().trim().min(1)),
});

const broadcastMarkFailedSchema = z.object({
  broadcastId: z.string().uuid(),
  recipients: z.array(z.string().trim().min(1)).min(1),
});

const broadcastRetryResultsSchema = z.object({
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
  });

  return {
    broadcastId: broadcast.id,
    totalRecipients: broadcast.totalRecipients,
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
    const recipient = await claimNextBroadcastRecipient(
      broadcast.id,
      index === 0 ? body.cursor : undefined,
    );

    if (!recipient) {
      break;
    }

    const result = await target.deliver(rendered, recipient);
    await recordBroadcastDelivery(broadcast.id, recipient, result);

    if (index < limits.batchSize - 1) {
      await sleep(limits.sendDelayMs);
    }
  }

  const latest = await getBroadcastLog(broadcast.id);
  return buildBroadcastStatus(latest);
}

export async function getBroadcastDeliveryDetails(
  broadcastId: string,
): Promise<BroadcastDeliveryDetails> {
  await requireOrganizer();
  const [log, deliveries] = await Promise.all([
    getBroadcastLog(broadcastId),
    listBroadcastDeliveries(broadcastId),
  ]);
  const { totalRecipients, sentCount, failedCount, pendingCount } =
    broadcastDeliveryProgress(log);

  return {
    status: log.status,
    totalRecipients,
    sentCount,
    failedCount,
    pendingCount,
    ...categorizeBroadcastDeliveries(log.status, deliveries),
  };
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

  const deliveries = await listBroadcastDeliveries(body.broadcastId);
  const categorized = categorizeBroadcastDeliveries(log.status, deliveries);
  const failureSet = new Set(
    [...categorized.retryFailures, ...categorized.omittedFailures].map(
      (failure) => failure.recipient,
    ),
  );
  const omittedTo = normalizeRecipientList(
    body.omittedTo,
    failureSet,
    (recipient) => `Recipient is not eligible to omit: ${recipient}`,
  );

  await db.transaction(async (tx) => {
    if (omittedTo.length > 0) {
      await tx
        .update(broadcastDeliveries)
        .set({ omitted: true })
        .where(
          and(
            eq(broadcastDeliveries.broadcastId, body.broadcastId),
            eq(broadcastDeliveries.status, "failed"),
            inArray(broadcastDeliveries.recipient, omittedTo),
          ),
        );
    }

    const clearOmitted = [
      eq(broadcastDeliveries.broadcastId, body.broadcastId),
      eq(broadcastDeliveries.status, "failed"),
    ];

    if (omittedTo.length > 0) {
      clearOmitted.push(notInArray(broadcastDeliveries.recipient, omittedTo));
    }

    await tx
      .update(broadcastDeliveries)
      .set({ omitted: false })
      .where(and(...clearOmitted));

    await syncBroadcastCounts(tx, body.broadcastId);
  });

  return getBroadcastDeliveryDetails(body.broadcastId);
}

export async function markBroadcastDeliveriesFailed(input: unknown) {
  await requireOrganizer();
  const body = broadcastMarkFailedSchema.parse(input);
  const log = await getBroadcastLog(body.broadcastId);

  if (log.status !== "complete") {
    throw new EmailCampaignError(
      "Delivered recipients can only be marked as failed on completed broadcasts.",
      409,
    );
  }

  const deliveries = await listBroadcastDeliveries(body.broadcastId);
  const deliveredSet = new Set(
    categorizeBroadcastDeliveries(log.status, deliveries).deliveredTo,
  );
  const recipients = normalizeRecipientList(
    body.recipients,
    deliveredSet,
    (recipient) => `Recipient was not delivered: ${recipient}`,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(broadcastDeliveries)
      .set({
        status: "failed",
        error: BROADCAST_MANUAL_FAILURE_ERROR,
        omitted: false,
      })
      .where(
        and(
          eq(broadcastDeliveries.broadcastId, body.broadcastId),
          eq(broadcastDeliveries.status, "sent"),
          inArray(broadcastDeliveries.recipient, recipients),
        ),
      );

    await syncBroadcastCounts(tx, body.broadcastId);
  });

  return getBroadcastDeliveryDetails(body.broadcastId);
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

  const deliveries = await listBroadcastDeliveries(body.broadcastId);
  const failedRecipientSet = new Set(
    categorizeBroadcastDeliveries(
      original.status,
      deliveries,
    ).retryFailures.map((failure) => failure.recipient),
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
  });

  return {
    broadcastId: broadcast.id,
    totalRecipients: broadcast.totalRecipients,
    status: buildBroadcastStatus(broadcast),
  };
}

export async function applyBroadcastRetryResults(input: unknown) {
  const organizer = await requireOrganizer();
  const body = broadcastRetryResultsSchema.parse(input);

  const [original, retry] = await Promise.all([
    getBroadcastLogForOrganizer(body.originalBroadcastId, organizer.id),
    getBroadcastLogForOrganizer(
      body.retryBroadcastId,
      organizer.id,
      "Retry broadcast not found",
    ),
  ]);

  if (retry.status !== "complete") {
    throw new EmailCampaignError("Retry broadcast is not complete yet.", 409);
  }

  const [originalDeliveries, retryDeliveries] = await Promise.all([
    listBroadcastDeliveries(original.id),
    listBroadcastDeliveries(retry.id),
  ]);
  const eligibleRecipients = new Set(
    categorizeBroadcastDeliveries(
      original.status,
      originalDeliveries,
    ).retryFailures.map((failure) => failure.recipient),
  );

  for (const delivery of retryDeliveries) {
    if (!eligibleRecipients.has(delivery.recipient)) {
      throw new EmailCampaignError(
        `Recipient is not eligible for retry merge: ${delivery.recipient}`,
        400,
      );
    }
  }

  await db.transaction(async (tx) => {
    const sentRecipients = retryDeliveries
      .filter((delivery) => delivery.status === "sent")
      .map((delivery) => delivery.recipient);
    const failedByError = new Map<string, string[]>();

    for (const delivery of retryDeliveries) {
      if (delivery.status === "sent") {
        continue;
      }

      const error = delivery.error ?? "Delivery failed";
      const recipients = failedByError.get(error);

      if (recipients) {
        recipients.push(delivery.recipient);
      } else {
        failedByError.set(error, [delivery.recipient]);
      }
    }

    if (sentRecipients.length > 0) {
      await tx
        .update(broadcastDeliveries)
        .set({ status: "sent", error: null, omitted: false })
        .where(
          and(
            eq(broadcastDeliveries.broadcastId, original.id),
            inArray(broadcastDeliveries.recipient, sentRecipients),
          ),
        );
    }

    for (const [error, recipients] of failedByError) {
      await tx
        .update(broadcastDeliveries)
        .set({ status: "failed", error })
        .where(
          and(
            eq(broadcastDeliveries.broadcastId, original.id),
            inArray(broadcastDeliveries.recipient, recipients),
          ),
        );
    }

    await syncBroadcastCounts(tx, original.id);
  });

  return getBroadcastDeliveryDetails(original.id);
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

type BroadcastDbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function claimNextBroadcastRecipient(
  broadcastId: string,
  expectedCursor?: number,
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [broadcast] = await tx
      .select()
      .from(broadcastLogs)
      .where(eq(broadcastLogs.id, broadcastId))
      .limit(1)
      .for("update");

    if (!broadcast || broadcast.status !== "sending") {
      return null;
    }

    if (
      expectedCursor !== undefined &&
      broadcast.nextCursor !== expectedCursor
    ) {
      return null;
    }

    if (broadcast.processingRecipient) {
      if (broadcastLeaseIsActive(broadcast)) {
        return null;
      }

      await tx
        .update(broadcastLogs)
        .set({
          leaseExpiresAt: broadcastLeaseExpiry(),
        })
        .where(eq(broadcastLogs.id, broadcastId));

      return broadcast.processingRecipient;
    }

    if (broadcast.nextCursor >= broadcast.totalRecipients) {
      await finalizeBroadcastIfComplete(tx, broadcast);
      return null;
    }

    const [delivery] = await tx
      .select({ recipient: broadcastDeliveries.recipient })
      .from(broadcastDeliveries)
      .where(
        and(
          eq(broadcastDeliveries.broadcastId, broadcastId),
          eq(broadcastDeliveries.position, broadcast.nextCursor),
        ),
      )
      .limit(1);

    if (!delivery) {
      await finalizeBroadcastIfComplete(tx, broadcast);
      return null;
    }

    await tx
      .update(broadcastLogs)
      .set({
        processingRecipient: delivery.recipient,
        leaseExpiresAt: broadcastLeaseExpiry(),
      })
      .where(eq(broadcastLogs.id, broadcastId));

    return delivery.recipient;
  });
}

async function recordBroadcastDelivery(
  broadcastId: string,
  recipient: string,
  result: BroadcastDeliveryResult,
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

    const nextCursor = broadcast.nextCursor + 1;
    const complete = nextCursor >= broadcast.totalRecipients;
    const sent = result.status === "sent";
    const sentCount = sent ? broadcast.sentCount + 1 : broadcast.sentCount;
    const failedCount = sent
      ? broadcast.failedCount
      : broadcast.failedCount + 1;
    const retryFailedCount = sent
      ? broadcast.retryFailedCount
      : broadcast.retryFailedCount + 1;

    await tx
      .update(broadcastDeliveries)
      .set(
        sent
          ? { status: "sent", error: null, omitted: false }
          : {
              status: "failed",
              error: result.error ?? "Unknown delivery error",
            },
      )
      .where(
        and(
          eq(broadcastDeliveries.broadcastId, broadcastId),
          eq(broadcastDeliveries.recipient, recipient),
        ),
      );

    await tx
      .update(broadcastLogs)
      .set({
        nextCursor,
        processingRecipient: null,
        leaseExpiresAt: complete ? null : broadcastLeaseExpiry(),
        status: complete ? "complete" : "sending",
        sentCount,
        failedCount,
        retryFailedCount,
      })
      .where(eq(broadcastLogs.id, broadcastId));
  });
}

async function finalizeBroadcastIfComplete(
  tx: BroadcastDbTx,
  broadcast: BroadcastLogRow,
) {
  const accounted = broadcast.sentCount + broadcast.failedCount;

  if (
    broadcast.status === "complete" ||
    broadcast.nextCursor < broadcast.totalRecipients ||
    accounted < broadcast.totalRecipients
  ) {
    return;
  }

  await tx
    .update(broadcastLogs)
    .set({
      status: "complete",
      processingRecipient: null,
      leaseExpiresAt: null,
    })
    .where(eq(broadcastLogs.id, broadcast.id));
}

async function expireStaleBroadcasts(target: string) {
  const now = new Date().toISOString();

  await db
    .update(broadcastLogs)
    .set({
      status: "expired",
      processingRecipient: null,
      leaseExpiresAt: null,
    })
    .where(
      and(
        eq(broadcastLogs.status, "sending"),
        eq(broadcastLogs.target, target),
        or(
          isNull(broadcastLogs.leaseExpiresAt),
          lt(broadcastLogs.leaseExpiresAt, now),
        ),
      ),
    );
}

function broadcastLeaseIsActive(broadcast: BroadcastLogRow) {
  return Boolean(
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
  notFoundMessage = "Broadcast not found",
) {
  const log = await getBroadcastLog(broadcastId);

  if (log.sentBy !== organizerId) {
    throw new EmailCampaignError(notFoundMessage, 404);
  }

  return log;
}

async function listBroadcastDeliveries(broadcastId: string) {
  return db
    .select({
      recipient: broadcastDeliveries.recipient,
      status: broadcastDeliveries.status,
      error: broadcastDeliveries.error,
      omitted: broadcastDeliveries.omitted,
    })
    .from(broadcastDeliveries)
    .where(eq(broadcastDeliveries.broadcastId, broadcastId))
    .orderBy(broadcastDeliveries.position);
}

async function syncBroadcastCounts(tx: BroadcastDbTx, broadcastId: string) {
  const [counts] = await tx
    .select({
      sentCount: sql<number>`count(*) filter (where ${broadcastDeliveries.status} = 'sent')::int`,
      failedCount: sql<number>`count(*) filter (where ${broadcastDeliveries.status} = 'failed')::int`,
      retryFailedCount: sql<number>`count(*) filter (where ${broadcastDeliveries.status} = 'failed' and ${broadcastDeliveries.omitted} = false)::int`,
    })
    .from(broadcastDeliveries)
    .where(eq(broadcastDeliveries.broadcastId, broadcastId));

  await tx
    .update(broadcastLogs)
    .set({
      sentCount: counts?.sentCount ?? 0,
      failedCount: counts?.failedCount ?? 0,
      retryFailedCount: counts?.retryFailedCount ?? 0,
    })
    .where(eq(broadcastLogs.id, broadcastId));
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
}) {
  const recipients = [...new Set(input.recipients)];

  await expireStaleBroadcasts(input.target);
  await assertNoActiveBroadcasts(input.sentBy, input.target, {
    organizerInProgress: input.organizerInProgressMessage,
    targetInProgress: input.targetInProgressMessage,
  });

  try {
    return await db.transaction(async (tx) => {
      const [broadcast] = await tx
        .insert(broadcastLogs)
        .values({
          target: input.target,
          subject: input.subject,
          body: input.body,
          sentBy: input.sentBy,
          status: "sending",
          totalRecipients: recipients.length,
          sentCount: 0,
          failedCount: 0,
          retryFailedCount: 0,
          nextCursor: 0,
          leaseExpiresAt: broadcastLeaseExpiry(),
        })
        .returning();

      if (!broadcast) {
        throw new EmailCampaignError("Could not create broadcast", 500);
      }

      await tx.insert(broadcastDeliveries).values(
        recipients.map((recipient, position) => ({
          broadcastId: broadcast.id,
          recipient,
          position,
          status: "pending",
        })),
      );

      return broadcast;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
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
