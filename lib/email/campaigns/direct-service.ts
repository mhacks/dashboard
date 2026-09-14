import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, ne, or } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  emailSendDeliveries,
  emailSendRuns,
  type EmailSendDeliveryRow,
  type EmailSendFailure,
  type EmailSendRunRow,
} from "@/lib/db/schema/email";
import {
  EmailCampaignError,
  getCampaignLimits,
} from "@/lib/email/campaigns/config";
import { requiredEmailCampaignTestRecipients } from "@/lib/email/campaigns/constants";
import {
  mergeDataForEmail,
  parseRecipientText,
} from "@/lib/email/campaigns/recipients";
import {
  sendSnapshotToEmail,
  snapshotFromDirectTemplate,
  type SendResult,
} from "@/lib/email/campaigns/service";
import { defaultEmailTheme } from "@/lib/email/theme";
import {
  directBatchSendSchema,
  directEmailTemplateSchema,
  directRecipientParseSchema,
  directSendOneSchema,
  directTestSendSchema,
  type DirectEmailTemplateInput,
} from "@/lib/email/types";

const successfulTestProofWindowMs = 30 * 60 * 1000;
const activeSendRecoveryWindowMs = 7 * 24 * 60 * 60 * 1000;
const compactRunRetentionMs = 30 * 24 * 60 * 60 * 1000;
const expiredTestProofRetentionMs = 60 * 60 * 1000;

interface ApprovedTestSend {
  templateFingerprint: string;
  testSendToken: string;
  testSendExpiresAt: string;
}

export async function parseDirectRecipients(input: unknown) {
  await requireOrganizer();
  const body = directRecipientParseSchema.parse(input);
  const parsed = parseRecipientText(body.recipients);
  enforceRecipientLimit(parsed.emails.length);

  return parsed;
}

export async function sendOneDirectEmail(input: unknown) {
  await requireOrganizer();
  const body = directSendOneSchema.parse(input);
  const email = body.email.trim().toLowerCase();
  const mergeData = buildMergeData(email, body.mergeData);
  const campaign = campaignLikeFromDirectTemplate(body.template);
  const result = await sendSnapshotToEmail(campaign, email, mergeData);

  return result;
}

export async function sendDirectTestEmails(input: unknown) {
  const organizer = await requireOrganizer();
  await pruneExpiredSendData();
  const body = directTestSendSchema.parse(input);
  const templateFingerprint = fingerprintDirectTemplate(body.template);
  const recipients = requiredEmailCampaignTestRecipients;
  const campaignLike = {
    templateSnapshot: snapshotFromDirectTemplate(body.template),
    themeSnapshot:
      body.template.type === "structured"
        ? (body.template.theme ?? defaultEmailTheme)
        : null,
  };
  const results: SendResult[] = [];

  for (const recipient of recipients) {
    results.push(
      await sendSnapshotToEmail(
        campaignLike,
        recipient.email,
        buildMergeData(recipient.email, {
          ...body.mergeData,
          ...recipient.mergeData,
        }),
      ),
    );
  }

  const failedCount = results.filter(
    (result) => result.status === "failed",
  ).length;
  const testSendToken =
    results.length > 0 && failedCount === 0 ? randomUUID() : null;
  const testSendExpiresAt = testSendToken
    ? new Date(Date.now() + successfulTestProofWindowMs).toISOString()
    : null;
  if (testSendToken && testSendExpiresAt) {
    await recordSuccessfulTestSend({
      organizerId: organizer.id,
      templateFingerprint,
      testSendToken,
    });
  }

  return {
    results,
    testSendToken,
    testSendExpiresAt,
  };
}

export async function sendDirectBatch(input: unknown) {
  const organizer = await requireOrganizer();
  await pruneExpiredSendData();
  const body = directBatchSendSchema.parse(input);
  const parsed = parseRecipientText(body.recipients);
  const limits = getCampaignLimits();
  const templateFingerprint = fingerprintDirectTemplate(body.template);
  const recipientListHash = fingerprintRecipients(parsed.recipients);

  enforceRecipientLimit(parsed.emails.length);

  if (parsed.emails.length === 0) {
    throw new EmailCampaignError("Add at least one valid recipient", 400);
  }

  if (parsed.invalid.length > 0) {
    throw new EmailCampaignError(
      `Fix ${parsed.invalid.length} invalid recipient${
        parsed.invalid.length === 1 ? "" : "s"
      } before sending`,
      400,
    );
  }

  assertRequiredMergeColumns(body.template, parsed.columns);

  const recipients = parsed.recipients.map((recipient) => ({
    email: recipient.email,
    mergeData: buildMergeData(recipient.email, recipient.mergeData),
  }));
  const run = await resolveOrCreateSendRun({
    requestedRunId: body.runId,
    organizer,
    template: body.template,
    templateFingerprint,
    recipientListHash,
    recipients,
    testSendToken: body.testSendToken,
  });

  if (body.resolveInterrupted) {
    await resolveInterruptedDeliveries({
      run,
      organizerId: organizer.id,
      templateFingerprint,
      recipientListHash,
      totalRecipients: parsed.recipients.length,
    });
    return sendRunStatus(run.id, parsed);
  }

  const campaign = campaignLikeFromDirectTemplate(
    run.templateSnapshot ?? body.template,
  );
  const lease = await claimSendLease({
    runId: run.id,
    cursor: body.cursor,
    parsed,
    batchSize: limits.batchSize,
  });

  if (lease.status) {
    return lease.status;
  }

  for (const delivery of lease.deliveries) {
    const claimed = await markDeliverySending({
      runId: run.id,
      leaseToken: lease.leaseToken,
      recipientIndex: delivery.recipientIndex,
    });

    if (!claimed) {
      continue;
    }

    const result = await sendSnapshotToEmail(
      campaign,
      delivery.email,
      delivery.mergeData,
    );
    await recordDeliveryResult({
      runId: run.id,
      leaseToken: lease.leaseToken,
      recipientIndex: delivery.recipientIndex,
      result,
    });
    await sleep(limits.sendDelayMs);
  }

  await releaseSendLease({
    runId: run.id,
    leaseToken: lease.leaseToken,
  });

  return sendRunStatus(run.id, parsed);
}

export async function findActiveDirectSend(input: unknown) {
  const organizer = await requireOrganizer();
  await pruneExpiredSendData();
  const body = directBatchSendSchema
    .pick({ template: true, recipients: true })
    .parse(input);
  const parsed = parseRecipientText(body.recipients);

  if (parsed.emails.length === 0 || parsed.invalid.length > 0) {
    return null;
  }

  const templateFingerprint = fingerprintDirectTemplate(body.template);
  const recipientListHash = fingerprintRecipients(parsed.recipients);
  const [run] = await db
    .select()
    .from(emailSendRuns)
    .where(
      and(
        eq(emailSendRuns.organizerId, organizer.id),
        eq(emailSendRuns.templateFingerprint, templateFingerprint),
        eq(emailSendRuns.recipientListHash, recipientListHash),
        eq(emailSendRuns.status, "sending"),
      ),
    )
    .limit(1);

  return run ? sendRunStatus(run.id, parsed) : null;
}

function enforceRecipientLimit(count: number) {
  const { maxRecipients } = getCampaignLimits();

  if (count > maxRecipients) {
    throw new EmailCampaignError(
      `Recipient list exceeds ${maxRecipients} addresses`,
      400,
    );
  }
}

async function resolveOrCreateSendRun({
  requestedRunId,
  organizer,
  template,
  templateFingerprint,
  recipientListHash,
  recipients,
  testSendToken,
}: {
  requestedRunId: string;
  organizer: Awaited<ReturnType<typeof requireOrganizer>>;
  template: DirectEmailTemplateInput;
  templateFingerprint: string;
  recipientListHash: string;
  recipients: Array<{ email: string; mergeData: Record<string, string> }>;
  testSendToken: string | undefined;
}) {
  return db.transaction(async (tx) => {
    const [requestedRun] = await tx
      .select()
      .from(emailSendRuns)
      .where(eq(emailSendRuns.id, requestedRunId))
      .limit(1)
      .for("update");

    if (requestedRun) {
      assertRunIdentity(requestedRun, {
        organizerId: organizer.id,
        templateFingerprint,
        recipientListHash,
        totalRecipients: recipients.length,
      });

      if (requestedRun.status !== "sending") {
        throw new EmailCampaignError(
          "This send run is already finished. Start a new send.",
          409,
        );
      }

      return requestedRun;
    }

    const [activeRun] = await tx
      .select()
      .from(emailSendRuns)
      .where(
        and(
          eq(emailSendRuns.organizerId, organizer.id),
          eq(emailSendRuns.templateFingerprint, templateFingerprint),
          eq(emailSendRuns.recipientListHash, recipientListHash),
          eq(emailSendRuns.status, "sending"),
        ),
      )
      .limit(1)
      .for("update");

    if (activeRun) {
      return activeRun;
    }

    const [unrecoverableRun] = await tx
      .select()
      .from(emailSendRuns)
      .where(
        and(
          eq(emailSendRuns.organizerId, organizer.id),
          eq(emailSendRuns.templateFingerprint, templateFingerprint),
          eq(emailSendRuns.recipientListHash, recipientListHash),
          inArray(emailSendRuns.status, ["expired", "superseded"]),
        ),
      )
      .orderBy(desc(emailSendRuns.createdAt))
      .limit(1);

    if (unrecoverableRun) {
      throw new EmailCampaignError(
        "A previous interrupted send with this exact template and recipient list can no longer be resumed safely. Review it before starting another send.",
        409,
      );
    }

    await assertSuccessfulTestSend({
      organizer,
      template,
      testSendToken,
      tx,
    });

    const now = new Date().toISOString();
    const [createdRun] = await tx
      .insert(emailSendRuns)
      .values({
        id: requestedRunId,
        organizerId: organizer.id,
        templateFingerprint,
        recipientListHash,
        totalRecipients: recipients.length,
        templateSnapshot: template,
        status: "sending",
        sentCount: 0,
        failedCount: 0,
        nextCursor: 0,
        recentFailures: [],
        recoveryExpiresAt: recoveryExpiry(),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();

    if (createdRun) {
      await tx.insert(emailSendDeliveries).values(
        recipients.map((recipient, recipientIndex) => ({
          runId: createdRun.id,
          recipientIndex,
          email: recipient.email,
          mergeData: recipient.mergeData,
          status: "pending",
          createdAt: now,
        })),
      );
      return createdRun;
    }

    const [racedRun] = await tx
      .select()
      .from(emailSendRuns)
      .where(
        and(
          eq(emailSendRuns.organizerId, organizer.id),
          eq(emailSendRuns.templateFingerprint, templateFingerprint),
          eq(emailSendRuns.recipientListHash, recipientListHash),
          eq(emailSendRuns.status, "sending"),
        ),
      )
      .limit(1);

    if (!racedRun) {
      throw new EmailCampaignError("Could not create the send run", 409);
    }

    return racedRun;
  });
}

function assertRunIdentity(
  run: typeof emailSendRuns.$inferSelect,
  expected: {
    organizerId: string;
    templateFingerprint: string;
    recipientListHash: string;
    totalRecipients: number;
  },
) {
  if (
    run.organizerId !== expected.organizerId ||
    run.templateFingerprint !== expected.templateFingerprint ||
    run.recipientListHash !== expected.recipientListHash ||
    run.totalRecipients !== expected.totalRecipients
  ) {
    throw new EmailCampaignError(
      "This send run does not match the current template or recipient list. Start a new send.",
      409,
    );
  }
}

async function claimSendLease({
  runId,
  cursor,
  parsed,
  batchSize,
}: {
  runId: string;
  cursor: number;
  parsed: ReturnType<typeof parseRecipientText>;
  batchSize: number;
}) {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(emailSendRuns)
      .where(eq(emailSendRuns.id, runId))
      .limit(1)
      .for("update");

    if (!run) {
      throw new EmailCampaignError("Send run not found", 404);
    }

    if (run.status !== "sending") {
      return {
        status: buildSendRunStatus(run, [], parsed),
        leaseToken: null,
        deliveries: [],
      };
    }

    if (cursor > run.totalRecipients) {
      throw new EmailCampaignError("Invalid send cursor", 400);
    }

    const deliveries = await tx
      .select()
      .from(emailSendDeliveries)
      .where(eq(emailSendDeliveries.runId, runId))
      .orderBy(asc(emailSendDeliveries.recipientIndex));
    const currentStatus = buildSendRunStatus(run, deliveries, parsed);

    if (cursor !== currentStatus.nextCursor) {
      return { status: currentStatus, leaseToken: null, deliveries: [] };
    }

    if (currentStatus.interrupted || leaseIsActive(run)) {
      return { status: currentStatus, leaseToken: null, deliveries: [] };
    }

    const pendingDeliveries = deliveries
      .filter(
        (delivery) =>
          delivery.status === "pending" &&
          delivery.recipientIndex >= currentStatus.nextCursor,
      )
      .slice(0, batchSize);

    if (pendingDeliveries.length === 0) {
      const completedRun = await finalizeRun(tx, run, deliveries);
      return {
        status: buildSendRunStatus(completedRun, [], parsed),
        leaseToken: null,
        deliveries: [],
      };
    }

    const leaseToken = randomUUID();
    const now = new Date().toISOString();
    await tx
      .update(emailSendRuns)
      .set({
        leaseToken,
        leaseExpiresAt: leaseExpiry(),
        recoveryExpiresAt: recoveryExpiry(),
        updatedAt: now,
      })
      .where(eq(emailSendRuns.id, runId));

    return { status: null, leaseToken, deliveries: pendingDeliveries };
  });
}

async function markDeliverySending({
  runId,
  leaseToken,
  recipientIndex,
}: {
  runId: string;
  leaseToken: string;
  recipientIndex: number;
}) {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(emailSendRuns)
      .where(eq(emailSendRuns.id, runId))
      .limit(1)
      .for("update");

    if (!run || run.status !== "sending" || run.leaseToken !== leaseToken) {
      return false;
    }

    const [delivery] = await tx
      .select()
      .from(emailSendDeliveries)
      .where(
        and(
          eq(emailSendDeliveries.runId, runId),
          eq(emailSendDeliveries.recipientIndex, recipientIndex),
        ),
      )
      .limit(1)
      .for("update");

    if (!delivery || delivery.status !== "pending") {
      return false;
    }

    const now = new Date().toISOString();
    await tx
      .update(emailSendDeliveries)
      .set({ status: "sending", startedAt: now })
      .where(eq(emailSendDeliveries.id, delivery.id));
    await tx
      .update(emailSendRuns)
      .set({
        leaseExpiresAt: leaseExpiry(),
        recoveryExpiresAt: recoveryExpiry(),
        updatedAt: now,
      })
      .where(eq(emailSendRuns.id, run.id));

    return true;
  });
}

async function recordDeliveryResult({
  runId,
  leaseToken,
  recipientIndex,
  result,
}: {
  runId: string;
  leaseToken: string;
  recipientIndex: number;
  result: SendResult;
}) {
  await db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(emailSendRuns)
      .where(eq(emailSendRuns.id, runId))
      .limit(1)
      .for("update");

    if (!run || run.leaseToken !== leaseToken) {
      throw new EmailCampaignError("Send lease was lost", 409);
    }

    const [delivery] = await tx
      .select()
      .from(emailSendDeliveries)
      .where(
        and(
          eq(emailSendDeliveries.runId, runId),
          eq(emailSendDeliveries.recipientIndex, recipientIndex),
        ),
      )
      .limit(1)
      .for("update");

    if (!delivery || delivery.status !== "sending") {
      throw new EmailCampaignError("Active delivery not found", 409);
    }

    const now = new Date().toISOString();
    await tx
      .delete(emailSendDeliveries)
      .where(eq(emailSendDeliveries.id, delivery.id));

    const failure: EmailSendFailure = {
      email: delivery.email,
      error: result.error,
    };
    const [updatedRun] = await tx
      .update(emailSendRuns)
      .set({
        sentCount: result.status === "sent" ? run.sentCount + 1 : run.sentCount,
        failedCount:
          result.status === "failed" ? run.failedCount + 1 : run.failedCount,
        nextCursor: Math.max(run.nextCursor, recipientIndex + 1),
        recentFailures:
          result.status === "failed"
            ? [...run.recentFailures, failure].slice(-10)
            : run.recentFailures,
        leaseExpiresAt: leaseExpiry(),
        recoveryExpiresAt: recoveryExpiry(),
        updatedAt: now,
      })
      .where(eq(emailSendRuns.id, run.id))
      .returning();

    if (
      updatedRun &&
      updatedRun.sentCount + updatedRun.failedCount ===
        updatedRun.totalRecipients
    ) {
      await finalizeRun(tx, updatedRun, []);
    }
  });
}

async function releaseSendLease({
  runId,
  leaseToken,
}: {
  runId: string;
  leaseToken: string;
}) {
  await db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(emailSendRuns)
      .where(eq(emailSendRuns.id, runId))
      .limit(1)
      .for("update");

    if (!run || run.leaseToken !== leaseToken) {
      return;
    }

    const deliveries = await tx
      .select()
      .from(emailSendDeliveries)
      .where(eq(emailSendDeliveries.runId, runId))
      .orderBy(asc(emailSendDeliveries.recipientIndex));

    if (deliveries.length === 0) {
      await finalizeRun(tx, run, deliveries);
      return;
    }

    await tx
      .update(emailSendRuns)
      .set({
        leaseToken: null,
        leaseExpiresAt: null,
        recoveryExpiresAt: recoveryExpiry(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emailSendRuns.id, run.id));
  });
}

async function resolveInterruptedDeliveries({
  run,
  organizerId,
  templateFingerprint,
  recipientListHash,
  totalRecipients,
}: {
  run: EmailSendRunRow;
  organizerId: string;
  templateFingerprint: string;
  recipientListHash: string;
  totalRecipients: number;
}) {
  await db.transaction(async (tx) => {
    assertRunIdentity(run, {
      organizerId,
      templateFingerprint,
      recipientListHash,
      totalRecipients,
    });

    const [lockedRun] = await tx
      .select()
      .from(emailSendRuns)
      .where(eq(emailSendRuns.id, run.id))
      .limit(1)
      .for("update");

    if (!lockedRun || lockedRun.status !== "sending") {
      throw new EmailCampaignError("Active send run not found", 404);
    }

    if (leaseIsActive(lockedRun)) {
      throw new EmailCampaignError(
        "Wait for the active delivery to finish before resolving it.",
        409,
      );
    }

    const interrupted = await tx
      .select()
      .from(emailSendDeliveries)
      .where(
        and(
          eq(emailSendDeliveries.runId, run.id),
          eq(emailSendDeliveries.status, "sending"),
        ),
      )
      .orderBy(asc(emailSendDeliveries.recipientIndex))
      .for("update");

    if (interrupted.length === 0) {
      throw new EmailCampaignError("No interrupted deliveries found", 409);
    }

    const now = new Date().toISOString();
    const error =
      "Delivery became unverified during a server interruption and was not retried automatically.";
    const failures = interrupted.map((delivery) => ({
      email: delivery.email,
      error,
    }));

    await tx
      .delete(emailSendDeliveries)
      .where(
        and(
          eq(emailSendDeliveries.runId, run.id),
          eq(emailSendDeliveries.status, "sending"),
        ),
      );
    const [updatedRun] = await tx
      .update(emailSendRuns)
      .set({
        failedCount: lockedRun.failedCount + interrupted.length,
        nextCursor: Math.max(
          lockedRun.nextCursor,
          ...interrupted.map((delivery) => delivery.recipientIndex + 1),
        ),
        recentFailures: [...lockedRun.recentFailures, ...failures].slice(-10),
        leaseToken: null,
        leaseExpiresAt: null,
        recoveryExpiresAt: recoveryExpiry(),
        updatedAt: now,
      })
      .where(eq(emailSendRuns.id, run.id))
      .returning();

    if (
      updatedRun &&
      updatedRun.sentCount + updatedRun.failedCount ===
        updatedRun.totalRecipients
    ) {
      await finalizeRun(tx, updatedRun, []);
    }
  });
}

async function sendRunStatus(
  runId: string,
  parsed: ReturnType<typeof parseRecipientText>,
  tx: Pick<typeof db, "select"> = db,
) {
  const [run] = await tx
    .select()
    .from(emailSendRuns)
    .where(eq(emailSendRuns.id, runId))
    .limit(1);

  if (!run) {
    throw new EmailCampaignError("Send run not found", 404);
  }

  const deliveries = await tx
    .select()
    .from(emailSendDeliveries)
    .where(eq(emailSendDeliveries.runId, runId))
    .orderBy(asc(emailSendDeliveries.recipientIndex));

  return buildSendRunStatus(run, deliveries, parsed);
}

function buildSendRunStatus(
  run: EmailSendRunRow,
  deliveries: EmailSendDeliveryRow[],
  parsed: ReturnType<typeof parseRecipientText>,
) {
  const complete = run.status === "sent" || run.status === "failed";
  const activeLease = !complete && leaseIsActive(run);
  const activelySending = deliveries.filter(
    (delivery) => delivery.status === "sending",
  );
  const remainingCount = complete
    ? 0
    : Math.max(0, run.totalRecipients - run.sentCount - run.failedCount);
  const sendingCount = complete
    ? 0
    : Math.min(remainingCount, activelySending.length);
  const pendingCount = Math.max(0, remainingCount - sendingCount);
  const nextCursor = complete ? run.totalRecipients : run.nextCursor;

  const interruptedRecipients =
    !activeLease && activelySending.length > 0
      ? activelySending.map((delivery) => delivery.email)
      : [];

  return {
    runId: run.id,
    totalRecipients: run.totalRecipients,
    sentCount: run.sentCount,
    failedCount: run.failedCount,
    pendingCount,
    sendingCount,
    leaseActive: activeLease,
    leaseExpiresAt: activeLease ? run.leaseExpiresAt : null,
    nextCursor,
    complete,
    interrupted: interruptedRecipients.length > 0,
    invalid: parsed.invalid,
    duplicateCount: parsed.duplicateCount,
    columns: parsed.columns,
    unverifiedRecipients: interruptedRecipients,
    recentFailures: run.recentFailures,
  };
}

async function finalizeRun(
  tx: Pick<typeof db, "update" | "delete">,
  run: EmailSendRunRow,
  deliveries: EmailSendDeliveryRow[],
) {
  if (
    deliveries.length !== 0 ||
    run.sentCount + run.failedCount !== run.totalRecipients
  ) {
    throw new EmailCampaignError(
      "Send recovery data is incomplete; refusing to finalize the run",
      409,
    );
  }

  const sentCount = run.sentCount;
  const failedCount = run.failedCount;
  const now = new Date().toISOString();
  const [completedRun] = await tx
    .update(emailSendRuns)
    .set({
      status: failedCount > 0 ? "failed" : "sent",
      sentCount,
      failedCount,
      nextCursor: run.totalRecipients,
      recentFailures: [],
      templateSnapshot: null,
      leaseToken: null,
      leaseExpiresAt: null,
      recoveryExpiresAt: null,
      updatedAt: now,
      completedAt: now,
    })
    .where(eq(emailSendRuns.id, run.id))
    .returning();

  await tx
    .delete(emailSendDeliveries)
    .where(eq(emailSendDeliveries.runId, run.id));

  return (
    completedRun ?? {
      ...run,
      status: failedCount > 0 ? "failed" : "sent",
      sentCount,
      failedCount,
      nextCursor: run.totalRecipients,
      recentFailures: [],
      templateSnapshot: null,
      leaseToken: null,
      leaseExpiresAt: null,
      recoveryExpiresAt: null,
      updatedAt: now,
      completedAt: now,
    }
  );
}

function leaseIsActive(run: EmailSendRunRow) {
  return Boolean(
    run.leaseToken &&
    run.leaseExpiresAt &&
    Date.parse(run.leaseExpiresAt) > Date.now(),
  );
}

function leaseExpiry() {
  return new Date(
    Date.now() + getCampaignLimits().staleSendingLeaseMs,
  ).toISOString();
}

function recoveryExpiry() {
  return new Date(Date.now() + activeSendRecoveryWindowMs).toISOString();
}

async function pruneExpiredSendData() {
  const now = new Date().toISOString();
  const testProofCutoff = new Date(
    Date.now() - expiredTestProofRetentionMs,
  ).toISOString();
  const compactRunCutoff = new Date(
    Date.now() - compactRunRetentionMs,
  ).toISOString();

  await db.transaction(async (tx) => {
    const expiredRuns = await tx
      .select({ id: emailSendRuns.id })
      .from(emailSendRuns)
      .where(
        and(
          eq(emailSendRuns.status, "sending"),
          lt(emailSendRuns.recoveryExpiresAt, now),
        ),
      );
    const expiredRunIds = expiredRuns.map((run) => run.id);

    if (expiredRunIds.length > 0) {
      await tx
        .delete(emailSendDeliveries)
        .where(inArray(emailSendDeliveries.runId, expiredRunIds));
      await tx
        .update(emailSendRuns)
        .set({
          status: "expired",
          templateSnapshot: null,
          recentFailures: [],
          leaseToken: null,
          leaseExpiresAt: null,
          recoveryExpiresAt: null,
          updatedAt: now,
          completedAt: now,
        })
        .where(inArray(emailSendRuns.id, expiredRunIds));
    }

    await tx
      .delete(emailSendRuns)
      .where(
        or(
          and(
            eq(emailSendRuns.status, "test_sent"),
            lt(emailSendRuns.createdAt, testProofCutoff),
          ),
          and(
            ne(emailSendRuns.status, "sending"),
            ne(emailSendRuns.status, "test_sent"),
            lt(emailSendRuns.completedAt, compactRunCutoff),
          ),
        ),
      );
  });
}

async function findSuccessfulTestSend({
  organizer,
  template,
  testSendToken,
  tx = db,
}: {
  organizer: Awaited<ReturnType<typeof requireOrganizer>>;
  template: DirectEmailTemplateInput;
  testSendToken: string | undefined;
  tx?: Pick<typeof db, "select">;
}): Promise<ApprovedTestSend | null> {
  if (!testSendToken) {
    return null;
  }

  const expectedFingerprint = fingerprintDirectTemplate(template);
  const now = Date.now();
  const [proof] = await tx
    .select()
    .from(emailSendRuns)
    .where(eq(emailSendRuns.id, testSendToken))
    .limit(1);

  if (
    !proof ||
    proof.organizerId !== organizer.id ||
    proof.templateFingerprint !== expectedFingerprint ||
    proof.status !== "test_sent"
  ) {
    return null;
  }

  const testSendExpiresAt = new Date(
    Date.parse(proof.createdAt) + successfulTestProofWindowMs,
  ).toISOString();

  if (Date.parse(testSendExpiresAt) <= now) {
    return null;
  }

  return {
    templateFingerprint: expectedFingerprint,
    testSendToken,
    testSendExpiresAt,
  };
}

async function assertSuccessfulTestSend({
  organizer,
  template,
  testSendToken,
  tx = db,
}: {
  organizer: Awaited<ReturnType<typeof requireOrganizer>>;
  template: DirectEmailTemplateInput;
  testSendToken: string | undefined;
  tx?: Pick<typeof db, "select">;
}): Promise<ApprovedTestSend> {
  const matchingProof = await findSuccessfulTestSend({
    organizer,
    template,
    testSendToken,
    tx,
  });

  if (!matchingProof) {
    throw new EmailCampaignError(
      "Run a fresh successful test send before starting a full list send",
      428,
    );
  }

  return matchingProof;
}

async function recordSuccessfulTestSend({
  organizerId,
  templateFingerprint,
  testSendToken,
}: {
  organizerId: string;
  templateFingerprint: string;
  testSendToken: string;
}) {
  const now = new Date().toISOString();

  await db.insert(emailSendRuns).values({
    id: testSendToken,
    organizerId,
    templateFingerprint,
    recipientListHash: "test-send-proof",
    totalRecipients: requiredEmailCampaignTestRecipients.length,
    status: "test_sent",
    createdAt: now,
    updatedAt: now,
  });
}

function fingerprintDirectTemplate(template: DirectEmailTemplateInput) {
  const payload =
    template.type === "structured"
      ? {
          snapshot: snapshotFromDirectTemplate(template),
          theme: template.theme ?? defaultEmailTheme,
        }
      : {
          snapshot: snapshotFromDirectTemplate(template),
          theme: null,
        };

  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function fingerprintRecipients(
  recipients: Array<{ email: string; mergeData: Record<string, string> }>,
) {
  return createHash("sha256")
    .update(
      stableStringify(
        recipients.map((recipient) => ({
          email: recipient.email,
          mergeData: recipient.mergeData,
        })),
      ),
    )
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildMergeData(email: string, mergeData?: Record<string, string>) {
  return {
    ...mergeDataForEmail(email),
    ...mergeData,
    email,
  };
}

function assertRequiredMergeColumns(
  template: DirectEmailTemplateInput,
  columns: string[],
) {
  const columnSet = new Set(columns);
  const builtInFields = new Set(["email", "name"]);
  const missing = extractDirectTemplateMergeFields(template).filter(
    (field) => !builtInFields.has(field) && !columnSet.has(field),
  );

  if (missing.length > 0) {
    throw new EmailCampaignError(
      `Recipient list is missing required merge column${
        missing.length === 1 ? "" : "s"
      }: ${missing.join(", ")}`,
      400,
    );
  }
}

function extractDirectTemplateMergeFields(template: DirectEmailTemplateInput) {
  const values =
    template.type === "html"
      ? [template.subject, template.previewText, template.html]
      : [
          template.subject,
          template.previewText,
          template.content.eyebrow ?? "",
          template.content.heading,
          template.content.intro ?? "",
          template.content.cta?.label ?? "",
          template.content.cta?.url ?? "",
          template.content.footerNote ?? "",
          ...template.content.sections.flatMap((section) => [
            section.title ?? "",
            section.body,
          ]),
        ];
  const fields = new Set<string>();
  const pattern = /{{\s*([\w.-]+)\s*}}/g;

  for (const value of values) {
    for (const match of value.matchAll(pattern)) {
      fields.add(match[1]);
    }
  }

  return Array.from(fields).sort((left, right) => left.localeCompare(right));
}

function campaignLikeFromDirectTemplate(template: DirectEmailTemplateInput) {
  return {
    templateSnapshot: snapshotFromDirectTemplate(template),
    themeSnapshot:
      template.type === "structured"
        ? (template.theme ?? defaultEmailTheme)
        : null,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateDirectEmailTemplate(input: unknown) {
  return directEmailTemplateSchema.parse(input);
}
