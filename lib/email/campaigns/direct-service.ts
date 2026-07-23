import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { requireOrganizer } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  emailSendBatches,
  emailSendRuns,
  type EmailSendBatchRow,
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

interface ApprovedTestSend {
  templateFingerprint: string;
  testSendToken: string;
  testSendExpiresAt: string;
}

interface RecentFailure {
  email: string;
  error: string | null;
}

export function parseDirectRecipients(input: unknown) {
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
  const signedTestSendToken =
    testSendToken && testSendExpiresAt
      ? signTestSendProof({
          organizerId: organizer.id,
          templateFingerprint,
          testSendToken,
          testSendExpiresAt,
        })
      : null;

  return {
    results,
    testSendToken: signedTestSendToken,
    testSendExpiresAt,
  };
}

export async function sendDirectBatch(input: unknown) {
  const organizer = await requireOrganizer();
  const body = directBatchSendSchema.parse(input);
  const parsed = parseRecipientText(body.recipients);
  const limits = getCampaignLimits();
  const templateFingerprint = fingerprintDirectTemplate(body.template);
  const recipientListHash = fingerprintRecipients(parsed.recipients);

  enforceRecipientLimit(parsed.emails.length);

  if (parsed.emails.length === 0) {
    throw new EmailCampaignError("Add at least one valid recipient", 400);
  }

  if (body.resolveStaleBatch) {
    await resolveStaleSendBatch({
      runId: body.runId,
      organizerId: organizer.id,
      templateFingerprint,
      recipientListHash,
      totalRecipients: parsed.recipients.length,
      cursor: body.resolveStaleBatch.cursor,
      parsed,
    });

    return sendRunStatus(body.runId, parsed);
  }

  assertSuccessfulTestSend({
    organizer,
    template: body.template,
    testSendToken: body.testSendToken,
  });

  const recipients = parsed.recipients.map((recipient) => ({
    email: recipient.email,
    mergeData: buildMergeData(recipient.email, recipient.mergeData),
  }));
  const campaign = campaignLikeFromDirectTemplate(body.template);
  const batchRecipients = recipients.slice(
    body.cursor,
    body.cursor + limits.batchSize,
  );
  const claim = await claimSendBatch({
    runId: body.runId,
    organizerId: organizer.id,
    templateFingerprint,
    recipientListHash,
    totalRecipients: parsed.recipients.length,
    cursor: body.cursor,
    endCursor: body.cursor + batchRecipients.length,
    parsed,
  });

  if (claim.status) {
    return claim.status;
  }

  const results: SendResult[] = [];

  for (const recipient of batchRecipients) {
    const result = await sendSnapshotToEmail(
      campaign,
      recipient.email,
      recipient.mergeData,
    );
    results.push(result);
    await updateSendBatchProgress({
      runId: body.runId,
      cursor: body.cursor,
      results,
    });
    await sleep(limits.sendDelayMs);
  }

  const sentCount =
    results.filter((result) => result.status === "sent").length;
  const failedResults = results.filter((result) => result.status === "failed");
  const failedCount = failedResults.length;
  const recentFailures = [
    ...failedResults.map((result) => ({
      email: result.email,
      error: result.error,
    })),
  ].slice(-10);

  await completeSendBatch({
    runId: body.runId,
    cursor: body.cursor,
    sentCount,
    failedCount,
    recentFailures,
  });

  return sendRunStatus(body.runId, parsed);
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

async function claimSendBatch({
  runId,
  organizerId,
  templateFingerprint,
  recipientListHash,
  totalRecipients,
  cursor,
  endCursor,
  parsed,
}: {
  runId: string;
  organizerId: string;
  templateFingerprint: string;
  recipientListHash: string;
  totalRecipients: number;
  cursor: number;
  endCursor: number;
  parsed: ReturnType<typeof parseRecipientText>;
}) {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(emailSendRuns)
      .where(eq(emailSendRuns.id, runId))
      .limit(1)
      .for("update");
    const now = new Date().toISOString();

    if (run) {
      if (
        run.organizerId !== organizerId ||
        run.templateFingerprint !== templateFingerprint ||
        run.recipientListHash !== recipientListHash ||
        run.totalRecipients !== totalRecipients
      ) {
        throw new EmailCampaignError(
          "This send run does not match the current template or recipient list. Start a new send.",
          409,
        );
      }
    } else {
      await tx.insert(emailSendRuns).values({
        id: runId,
        organizerId,
        templateFingerprint,
        recipientListHash,
        totalRecipients,
        status: "sending",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (cursor > totalRecipients) {
      throw new EmailCampaignError("Invalid send cursor", 400);
    }

    if (cursor === totalRecipients) {
      return { status: await sendRunStatus(runId, parsed, tx) };
    }

    const currentStatus = await sendRunStatus(runId, parsed, tx);

    if (cursor !== currentStatus.nextCursor) {
      return { status: currentStatus };
    }

    const [existingBatch] = await tx
      .select()
      .from(emailSendBatches)
      .where(
        and(
          eq(emailSendBatches.runId, runId),
          eq(emailSendBatches.cursor, cursor),
        ),
      )
      .limit(1);

    if (existingBatch) {
      if (existingBatch.status === "complete") {
        return { status: await sendRunStatus(runId, parsed, tx) };
      }

      if (batchIsStale(existingBatch)) {
        return {
          status: {
            ...(await sendRunStatus(runId, parsed, tx)),
            staleBatchCursor: cursor,
          },
        };
      }

      return { status: await sendRunStatus(runId, parsed, tx) };
    }

    await tx.insert(emailSendBatches).values({
      runId,
      cursor,
      endCursor,
      status: "sending",
      sentCount: 0,
      failedCount: 0,
      recentFailures: [],
      createdAt: now,
      updatedAt: now,
    });

    return { status: null };
  });
}

async function completeSendBatch({
  runId,
  cursor,
  sentCount,
  failedCount,
  recentFailures,
}: {
  runId: string;
  cursor: number;
  sentCount: number;
  failedCount: number;
  recentFailures: RecentFailure[];
}) {
  const now = new Date().toISOString();

  await db
    .update(emailSendBatches)
    .set({
      status: "complete",
      sentCount,
      failedCount,
      recentFailures,
      updatedAt: now,
      completedAt: now,
    })
    .where(
      and(eq(emailSendBatches.runId, runId), eq(emailSendBatches.cursor, cursor)),
    );
}

async function updateSendBatchProgress({
  runId,
  cursor,
  results,
}: {
  runId: string;
  cursor: number;
  results: SendResult[];
}) {
  const now = new Date().toISOString();
  const failedResults = results.filter((result) => result.status === "failed");

  await db
    .update(emailSendBatches)
    .set({
      sentCount: results.filter((result) => result.status === "sent").length,
      failedCount: failedResults.length,
      recentFailures: failedResults
        .map((result) => ({
          email: result.email,
          error: result.error,
        }))
        .slice(-10),
      updatedAt: now,
    })
    .where(
      and(eq(emailSendBatches.runId, runId), eq(emailSendBatches.cursor, cursor)),
    );
}

async function resolveStaleSendBatch({
  runId,
  organizerId,
  templateFingerprint,
  recipientListHash,
  totalRecipients,
  cursor,
  parsed,
}: {
  runId: string;
  organizerId: string;
  templateFingerprint: string;
  recipientListHash: string;
  totalRecipients: number;
  cursor: number;
  parsed: ReturnType<typeof parseRecipientText>;
}) {
  await db.transaction(async (tx) => {
    await assertSendRunMatches({
      tx,
      runId,
      organizerId,
      templateFingerprint,
      recipientListHash,
      totalRecipients,
    });

    const [batch] = await tx
      .select()
      .from(emailSendBatches)
      .where(
        and(
          eq(emailSendBatches.runId, runId),
          eq(emailSendBatches.cursor, cursor),
        ),
      )
      .limit(1)
      .for("update");

    if (!batch) {
      throw new EmailCampaignError("Stale batch not found", 404);
    }

    if (batch.status === "complete") {
      return;
    }

    if (!batchIsStale(batch)) {
      throw new EmailCampaignError(
        "Wait for the active batch to finish before resolving it.",
        409,
      );
    }

    const batchSize = Math.max(0, batch.endCursor - batch.cursor);
    const recordedCount = batch.sentCount + batch.failedCount;
    const unverifiedCount = Math.max(0, batchSize - recordedCount);
    const unverifiedFailures = parsed.recipients
      .slice(batch.cursor + recordedCount, batch.endCursor)
      .map((recipient) => ({
        email: recipient.email,
        error:
          "Batch was manually resolved after SES verification. Recipient was not retried automatically.",
      }));
    const now = new Date().toISOString();

    await tx
      .update(emailSendBatches)
      .set({
        status: "complete",
        failedCount: batch.failedCount + unverifiedCount,
        recentFailures: [
          ...batch.recentFailures,
          ...unverifiedFailures,
        ].slice(-10),
        updatedAt: now,
        completedAt: now,
      })
      .where(eq(emailSendBatches.id, batch.id));
  });
}

async function assertSendRunMatches({
  tx,
  runId,
  organizerId,
  templateFingerprint,
  recipientListHash,
  totalRecipients,
}: {
  tx: Pick<typeof db, "select">;
  runId: string;
  organizerId: string;
  templateFingerprint: string;
  recipientListHash: string;
  totalRecipients: number;
}) {
  const [run] = await tx
    .select()
    .from(emailSendRuns)
    .where(eq(emailSendRuns.id, runId))
    .limit(1);

  if (!run) {
    throw new EmailCampaignError("Send run not found", 404);
  }

  if (
    run.organizerId !== organizerId ||
    run.templateFingerprint !== templateFingerprint ||
    run.recipientListHash !== recipientListHash ||
    run.totalRecipients !== totalRecipients
  ) {
    throw new EmailCampaignError(
      "This send run does not match the current template or recipient list. Start a new send.",
      409,
    );
  }
}

async function sendRunStatus(
  runId: string,
  parsed: ReturnType<typeof parseRecipientText>,
  tx: Pick<typeof db, "select" | "update"> = db,
) {
  const batches = await tx
    .select()
    .from(emailSendBatches)
    .where(eq(emailSendBatches.runId, runId))
    .orderBy(asc(emailSendBatches.cursor));
  const completedBatches = batches.filter(
    (batch) => batch.status === "complete",
  );
  const sentCount = completedBatches.reduce(
    (total, batch) => total + batch.sentCount,
    0,
  );
  const failedCount = completedBatches.reduce(
    (total, batch) => total + batch.failedCount,
    0,
  );
  let nextCursor = 0;

  for (const batch of completedBatches.sort((left, right) => left.cursor - right.cursor)) {
    if (batch.cursor !== nextCursor) {
      break;
    }

    nextCursor = batch.endCursor;
  }

  const activeBatch = batches.find(
    (batch) => batch.status === "sending" && batch.cursor === nextCursor,
  );
  const sendingCount = activeBatch
    ? Math.max(0, activeBatch.endCursor - activeBatch.cursor)
    : 0;
  const pendingCount = Math.max(
    0,
    parsed.recipients.length - nextCursor - sendingCount,
  );
  const complete =
    pendingCount === 0 && sendingCount === 0 && parsed.recipients.length > 0;
  const now = new Date().toISOString();

  await tx
    .update(emailSendRuns)
    .set({
      status: complete ? (failedCount > 0 ? "failed" : "sent") : "sending",
      updatedAt: now,
      completedAt: complete ? now : null,
    })
    .where(eq(emailSendRuns.id, runId));

  return {
    runId,
    totalRecipients: parsed.recipients.length,
    sentCount,
    failedCount,
    pendingCount,
    sendingCount,
    nextCursor,
    complete,
    invalid: parsed.invalid,
    duplicateCount: parsed.duplicateCount,
    columns: parsed.columns,
    recentFailures: completedBatches
      .flatMap((batch) => batch.recentFailures)
      .slice(-10),
  };
}

function batchIsStale(batch: EmailSendBatchRow) {
  return (
    Date.now() - Date.parse(batch.updatedAt) >
    getCampaignLimits().staleSendingLeaseMs
  );
}

function findSuccessfulTestSend({
  organizer,
  template,
  testSendToken,
}: {
  organizer: Awaited<ReturnType<typeof requireOrganizer>>;
  template: DirectEmailTemplateInput;
  testSendToken: string | undefined;
}): ApprovedTestSend | null {
  if (!testSendToken) {
    return null;
  }

  const expectedFingerprint = fingerprintDirectTemplate(template);
  const now = Date.now();
  const proof = verifyTestSendProof(testSendToken);

  if (
    !proof ||
    proof.organizerId !== organizer.id ||
    proof.templateFingerprint !== expectedFingerprint ||
    Date.parse(proof.testSendExpiresAt) <= now
  ) {
    return null;
  }

  return {
    templateFingerprint: expectedFingerprint,
    testSendToken: proof.testSendToken,
    testSendExpiresAt: proof.testSendExpiresAt,
  };
}

function assertSuccessfulTestSend({
  organizer,
  template,
  testSendToken,
}: {
  organizer: Awaited<ReturnType<typeof requireOrganizer>>;
  template: DirectEmailTemplateInput;
  testSendToken: string | undefined;
}): ApprovedTestSend {
  const matchingProof = findSuccessfulTestSend({
    organizer,
    template,
    testSendToken,
  });

  if (!matchingProof) {
    throw new EmailCampaignError(
      "Run a fresh successful test send before starting a full list send",
      428,
    );
  }

  return matchingProof;
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

function campaignLikeFromDirectTemplate(template: DirectEmailTemplateInput) {
  return {
    templateSnapshot: snapshotFromDirectTemplate(template),
    themeSnapshot:
      template.type === "structured"
        ? (template.theme ?? defaultEmailTheme)
        : null,
  };
}

function signTestSendProof(proof: ApprovedTestSend & { organizerId: string }) {
  const payload = base64UrlEncode(JSON.stringify(proof));
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

function verifyTestSendProof(token: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature || !signatureMatches(payload, signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as Record<
      string,
      unknown
    >;

    if (
      typeof parsed.organizerId !== "string" ||
      typeof parsed.templateFingerprint !== "string" ||
      typeof parsed.testSendToken !== "string" ||
      typeof parsed.testSendExpiresAt !== "string"
    ) {
      return null;
    }

    return {
      organizerId: parsed.organizerId,
      templateFingerprint: parsed.templateFingerprint,
      testSendToken: parsed.testSendToken,
      testSendExpiresAt: parsed.testSendExpiresAt,
    };
  } catch {
    return null;
  }
}

function signatureMatches(payload: string, signature: string) {
  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function sign(payload: string) {
  return createHmac("sha256", testProofSecret())
    .update(payload)
    .digest("base64url");
}

function testProofSecret() {
  return (
    process.env.EMAIL_CAMPAIGN_PROOF_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.DATABASE_URL ??
    "development-email-proof-secret"
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateDirectEmailTemplate(input: unknown) {
  return directEmailTemplateSchema.parse(input);
}
