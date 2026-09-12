"use client";

import { Database, ListChecks, Play, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MasterTemplate } from "@/lib/email/templates/master-service";
import type { EmailAudienceQuery } from "@/lib/email/types";
import {
  audienceDecisionOptions,
  audienceRsvpTravelPlanOptions,
  audienceTravelAwardOptions,
  builtInRecipientMergeFields,
  type CampaignLimits,
  type DirectSendStatus,
  type RecipientSaveResult,
  type RecipientSource,
  type SendJobSnapshot,
  type TestSendProof,
} from "./campaign-types";
import { formatTime } from "./campaign-helpers";
import { EditorSection, Field } from "./editor-ui";

export function SendPanel({
  selectedTemplate,
  mergeFields,
  limits,
  recipientSource,
  recipientText,
  recipientResult,
  audienceQuery,
  sendOneEmail,
  sendStatus,
  testSendProof,
  testSendJob,
  sendOneJob,
  notice,
  busy,
  onRecipientSourceChange,
  onRecipientTextChange,
  onAudienceQueryChange,
  onLoadAudience,
  onCheckRecipients,
  onSendOneEmailChange,
  onSendOne,
  onTestSend,
  onStartSend,
  onResolveInterrupted,
}: {
  selectedTemplate: MasterTemplate | null;
  mergeFields: string[];
  limits: CampaignLimits;
  recipientSource: RecipientSource;
  recipientText: string;
  recipientResult: RecipientSaveResult | null;
  audienceQuery: EmailAudienceQuery;
  sendOneEmail: string;
  sendStatus: DirectSendStatus | null;
  testSendProof: TestSendProof | null;
  testSendJob: SendJobSnapshot | null;
  sendOneJob: SendJobSnapshot | null;
  notice: string;
  busy: string | null;
  onRecipientSourceChange: (source: RecipientSource) => void;
  onRecipientTextChange: (value: string) => void;
  onAudienceQueryChange: (patch: Partial<EmailAudienceQuery>) => void;
  onLoadAudience: () => void;
  onCheckRecipients: () => void;
  onSendOneEmailChange: (value: string) => void;
  onSendOne: () => void;
  onTestSend: () => void;
  onStartSend: () => void;
  onResolveInterrupted: () => void;
}) {
  const sendRate = Math.floor(1000 / Math.max(1, limits.sendDelayMs));
  const templateCanSend = Boolean(
    selectedTemplate &&
    (selectedTemplate.type === "html" || selectedTemplate.content),
  );
  const requiredRecipientColumns = mergeFields.filter(
    (field) => !builtInRecipientMergeFields.has(field),
  );
  const recipientColumns = new Set(recipientResult?.columns ?? []);
  const missingRecipientColumns = recipientResult
    ? requiredRecipientColumns.filter((field) => !recipientColumns.has(field))
    : [];
  const fullSendUnlocked = Boolean(testSendProof || sendStatus);
  const recipientInputDisabled =
    !fullSendUnlocked || Boolean(busy) || recipientSource === "audience";
  const fullSendReady = Boolean(
    templateCanSend &&
    (testSendProof || sendStatus) &&
    recipientText.trim() &&
    recipientResult &&
    recipientResult.emails.length > 0 &&
    recipientResult.invalid.length === 0 &&
    missingRecipientColumns.length === 0,
  );

  const templateTypeLabel = selectedTemplate
    ? selectedTemplate.type === "html"
      ? "HTML template"
      : "Structured template"
    : "Select a template to send.";
  const limitsLabel = `${limits.maxRecipients} max recipients, ${limits.batchSize}/batch, about ${sendRate}/sec${
    limits.maxSendRatePerSecond ? ` max ${limits.maxSendRatePerSecond}/sec` : ""
  }`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {selectedTemplate?.name ?? "Send"}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {templateTypeLabel} · {limitsLabel}
        </p>
      </div>

      {notice ? (
        <p className="text-sm text-muted-foreground">{notice}</p>
      ) : null}

      {!templateCanSend ? (
        <p className="text-sm text-muted-foreground">
          Select a template with content before sending.
        </p>
      ) : null}

      <EditorSection
        title="Send required organizer test"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!templateCanSend || Boolean(busy)}
            onClick={onTestSend}
          >
            <ListChecks />
            {busy === "test-send" ? "Sending..." : "Test"}
          </Button>
        }
      >
        {testSendProof || testSendJob || busy === "test-send" ? (
          <SendJobProgress
            busy={busy === "test-send"}
            job={
              testSendJob ??
              (testSendProof
                ? {
                    total: testSendProof.totalCount,
                    sentCount: testSendProof.sentCount,
                    failedCount: 0,
                    complete: true,
                    failures: [],
                  }
                : null)
            }
            detail={
              testSendProof
                ? `Unlocked until ${formatTime(testSendProof.expiresAt)}.`
                : undefined
            }
          />
        ) : null}
      </EditorSection>

      <EditorSection title="Send one">
        <div className="flex items-center gap-2">
          <Input
            type="email"
            value={sendOneEmail}
            onChange={(event) => onSendOneEmailChange(event.target.value)}
            placeholder="one@email.com"
          />
          <Button
            type="button"
            size="sm"
            disabled={!templateCanSend || !sendOneEmail || Boolean(busy)}
            onClick={onSendOne}
          >
            <Send />
            {busy === "send-one" ? "Sending..." : "Send"}
          </Button>
        </div>
        <SendJobProgress busy={busy === "send-one"} job={sendOneJob} />
      </EditorSection>

      <EditorSection
        title="Load a recipient group"
        action={
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant={recipientSource === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => onRecipientSourceChange("manual")}
              disabled={Boolean(busy)}
            >
              <Users />
              Manual
            </Button>
            <Button
              type="button"
              variant={recipientSource === "audience" ? "default" : "outline"}
              size="sm"
              onClick={() => onRecipientSourceChange("audience")}
              disabled={Boolean(busy)}
            >
              <Database />
              Groups
            </Button>
          </div>
        }
      >
        {recipientSource === "audience" ? (
          <div className="grid gap-3 lg:grid-cols-3">
            <Field label="Decision group">
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                value={audienceQuery.decisionGroup}
                disabled={Boolean(busy)}
                onChange={(event) => {
                  const decisionGroup = event.target
                    .value as EmailAudienceQuery["decisionGroup"];

                  onAudienceQueryChange(
                    decisionGroup === "draft" || decisionGroup === "umich"
                      ? {
                          decisionGroup,
                          travelAward: "any",
                          rsvpTravelPlan: "any",
                        }
                      : { decisionGroup },
                  );
                }}
              >
                {audienceDecisionOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Travel award">
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                value={audienceQuery.travelAward}
                disabled={
                  Boolean(busy) ||
                  audienceQuery.decisionGroup === "draft" ||
                  audienceQuery.decisionGroup === "umich"
                }
                onChange={(event) =>
                  onAudienceQueryChange({
                    travelAward: event.target
                      .value as EmailAudienceQuery["travelAward"],
                  })
                }
              >
                {audienceTravelAwardOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="RSVP travel plan">
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                value={audienceQuery.rsvpTravelPlan}
                disabled={
                  Boolean(busy) ||
                  audienceQuery.decisionGroup === "draft" ||
                  audienceQuery.decisionGroup === "umich"
                }
                onChange={(event) =>
                  onAudienceQueryChange({
                    rsvpTravelPlan: event.target
                      .value as EmailAudienceQuery["rsvpTravelPlan"],
                  })
                }
              >
                {audienceRsvpTravelPlanOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
        <Textarea
          className="min-h-36 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          value={recipientText}
          disabled={recipientInputDisabled}
          onChange={(event) => onRecipientTextChange(event.target.value)}
          placeholder={
            fullSendUnlocked
              ? recipientSource === "audience"
                ? "Load a group to generate recipients from Supabase."
                : "email,name,travel_reimbursement\nhacker@umich.edu,Hacker,150.00"
              : "Run the required test send before adding recipients."
          }
        />
        <div className="flex items-center justify-end gap-3">
          {recipientResult ? (
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              {recipientResult.emails.length} valid,{" "}
              {recipientResult.duplicateCount} duplicates,{" "}
              {recipientResult.invalid.length} invalid
            </p>
          ) : null}
          {recipientSource === "audience" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!fullSendUnlocked || Boolean(busy)}
              onClick={onLoadAudience}
            >
              <Database />
              {busy === "load-audience" ? "Loading..." : "Load group"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={recipientInputDisabled || !recipientText.trim()}
              onClick={onCheckRecipients}
            >
              <Users />
              {busy === "check-recipients" ? "Checking..." : "Check list"}
            </Button>
          )}
        </div>
      </EditorSection>

      <EditorSection
        title="Send to all loaded recipients"
        action={
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !fullSendReady ||
                Boolean(busy) ||
                sendStatus?.complete ||
                sendStatus?.interrupted ||
                sendStatus?.leaseActive
              }
              onClick={onStartSend}
            >
              <Play />
              {busy === "start-send" ? "Sending..." : "Send all"}
            </Button>
            {sendStatus?.interrupted ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(busy)}
                onClick={onResolveInterrupted}
              >
                <ListChecks />
                Resolve interrupted delivery
              </Button>
            ) : null}
          </div>
        }
      >
        {sendStatus || busy === "start-send" ? (
          <>
            <SendJobProgress
              busy={busy === "start-send"}
              job={
                sendStatus
                  ? {
                      total: sendStatus.totalRecipients,
                      sentCount: sendStatus.sentCount,
                      failedCount: sendStatus.failedCount,
                      pendingCount: sendStatus.pendingCount,
                      sendingCount: sendStatus.sendingCount,
                      complete: sendStatus.complete,
                      failures: sendStatus.recentFailures,
                    }
                  : null
              }
              detail={
                sendStatus?.leaseActive && sendStatus.leaseExpiresAt
                  ? `Recovery available at ${formatTime(sendStatus.leaseExpiresAt)}`
                  : undefined
              }
            />
            {sendStatus?.interrupted ? (
              <div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {sendStatus.unverifiedRecipients.length
                  ? `Verify in SES before resolving: ${sendStatus.unverifiedRecipients.join(", ")}`
                  : "Verify the interrupted delivery in SES before resolving it."}
              </div>
            ) : null}
          </>
        ) : null}
      </EditorSection>
    </div>
  );
}

export function SendJobProgress({
  busy = false,
  job,
  detail,
}: {
  busy?: boolean;
  job: SendJobSnapshot | null;
  detail?: string;
}) {
  if (!job && !busy) {
    return null;
  }

  const total = job?.total ?? 0;
  const sentCount = job?.sentCount ?? 0;
  const failedCount = job?.failedCount ?? 0;
  const processed = sentCount + failedCount;
  const progress =
    total > 0 ? Math.round((processed / total) * 100) : busy ? null : 0;
  const sentWidth = total > 0 ? (sentCount / total) * 100 : 0;
  const failedWidth = total > 0 ? (failedCount / total) * 100 : 0;
  const summary = total
    ? `${sentCount} sent, ${failedCount} failed${
        job?.pendingCount ? `, ${job.pendingCount} pending` : ""
      }${job?.sendingCount ? `, ${job.sendingCount} sending` : ""}`
    : busy
      ? null
      : "Send failed";

  return (
    <div className="space-y-2">
      {summary || progress !== null ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {summary ? <p>{summary}</p> : null}
          {progress !== null ? <span>{progress}%</span> : null}
        </div>
      ) : null}
      <div className="flex h-2 overflow-hidden rounded-md bg-muted">
        {progress === null ? (
          <div className="h-full w-2/3 animate-pulse rounded-md bg-primary" />
        ) : (
          <>
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${sentWidth}%` }}
            />
            <div
              className="h-full bg-destructive transition-all duration-500"
              style={{ width: `${failedWidth}%` }}
            />
          </>
        )}
      </div>
      {detail ? (
        <p className="text-sm text-muted-foreground">{detail}</p>
      ) : null}
      {job?.failures.length ? (
        <div className="space-y-2">
          {job.failures.map((failure, index) => (
            <p
              key={`${failure.email ?? "recipient"}-${failure.error}-${index}`}
              className="rounded-md border border-red-200/60 bg-red-50 px-3 py-2 text-sm text-red-900"
            >
              {failure.email
                ? `${failure.email}: ${failure.error || "Send failed"}`
                : failure.error || "Send failed"}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
