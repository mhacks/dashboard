"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BROADCAST_BODY_LIMIT,
  BROADCAST_SUBJECT_LIMIT,
  broadcastErrorMessage,
} from "@/lib/broadcast/config";
import {
  BROADCAST_PAUSED_NOTICE,
  formatBroadcastOutcome,
  formatBroadcastProgress,
} from "@/lib/broadcast/progress";
import type {
  BroadcastSendStatus,
  BroadcastTargetSummary,
} from "@/lib/broadcast/types";
import {
  ChevronDownIcon,
  Loader2,
  SendHorizontalIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  findActiveBroadcastAction,
  listBroadcastTargetRecipientsAction,
  startBroadcastAction,
} from "./actions";
import { runBroadcastLoop } from "./run-broadcast-loop";
import { useSelectionSet } from "./use-selection-set";

type RecipientPreview =
  | { status: "loading" }
  | { status: "ready"; emails: string[] }
  | { status: "error"; message: string };

export default function BroadcastForm({
  targets,
  channelTargetId = null,
  onLogsInvalidated,
}: {
  targets: BroadcastTargetSummary[];
  channelTargetId?: string | null;
  onLogsInvalidated: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const channelLocked = Boolean(channelTargetId);
  const defaultTargetIds = channelTargetId ? [channelTargetId] : [];
  const {
    selected: selectedTargetIds,
    toggle: toggleTarget,
    setItems: setSelectedTargetIds,
  } = useSelectionSet(defaultTargetIds);
  const [bodyLength, setBodyLength] = useState(0);
  const [status, setStatus] = useState<BroadcastSendStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    subject: string;
    body: string;
  } | null>(null);
  const [successResult, setSuccessResult] = useState<{
    sent: number;
    failed: number;
  } | null>(null);
  const [isSending, startSending] = useTransition();

  const selectedTargets = targets.filter((target) =>
    selectedTargetIds.has(target.id),
  );
  const availableTargets = targets.filter(
    (target) => !selectedTargetIds.has(target.id),
  );
  const totalRecipientCount = selectedTargets.reduce(
    (sum, target) => sum + target.recipientCount,
    0,
  );

  useEffect(() => {
    void findActiveBroadcastAction()
      .then((active) => {
        if (active && !active.complete) {
          setStatus(active);
          setSelectedTargetIds([active.target]);
          setNotice(
            formatBroadcastProgress(active, { prefix: "Resuming broadcast" }),
          );
        }
      })
      .catch(() => undefined);
  }, [setSelectedTargetIds]);

  async function sendBroadcast(
    initialStatus: BroadcastSendStatus,
    targetLabel?: string,
  ): Promise<BroadcastSendStatus> {
    const finalStatus = await runBroadcastLoop(
      initialStatus,
      (currentStatus) => {
        setStatus(currentStatus);
        setNotice(
          formatBroadcastProgress(currentStatus, { prefix: targetLabel }),
        );
      },
    );

    if (!finalStatus.complete) {
      setNotice(BROADCAST_PAUSED_NOTICE);
    }

    return finalStatus;
  }

  async function resumeBroadcast() {
    if (!status || status.complete) {
      return;
    }

    startSending(async () => {
      try {
        const finalStatus = await sendBroadcast(status);
        if (finalStatus.complete) {
          setSuccessResult({
            sent: finalStatus.sentCount,
            failed: finalStatus.failedCount,
          });
        }
      } catch (error) {
        setNotice(broadcastErrorMessage(error));
      } finally {
        onLogsInvalidated();
      }
    });
  }

  function resetForm() {
    formRef.current?.reset();
    setBodyLength(0);
    setStatus(null);
    setNotice(null);
    setDraft(null);
    setSuccessResult(null);
    setSelectedTargetIds(defaultTargetIds);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedTargets.length === 0) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setDraft({
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
    });
  }

  function confirmSend() {
    if (selectedTargets.length === 0 || !draft) {
      return;
    }

    const pendingDraft = draft;
    setDraft(null);

    startSending(async () => {
      try {
        let totalSent = 0;
        let totalFailed = 0;

        for (const target of selectedTargets) {
          setNotice(`Starting broadcast to ${target.label}...`);
          const started = await startBroadcastAction({
            target: target.id,
            subject: pendingDraft.subject,
            body: pendingDraft.body,
          });
          const finalStatus = await sendBroadcast(started.status, target.label);

          if (!finalStatus.complete) {
            if (totalSent > 0 || totalFailed > 0) {
              setSuccessResult({ sent: totalSent, failed: totalFailed });
            }
            return;
          }

          totalSent += finalStatus.sentCount;
          totalFailed += finalStatus.failedCount;
        }

        setSuccessResult({ sent: totalSent, failed: totalFailed });
      } catch (error) {
        setNotice(broadcastErrorMessage(error));
      } finally {
        onLogsInvalidated();
      }
    });
  }

  const inProgress = Boolean(status && !status.complete);

  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No broadcast targets are configured.
      </p>
    );
  }

  const successDescription = successResult
    ? formatBroadcastOutcome(successResult.sent, successResult.failed, {
        finishedLabel: "Delivery",
        successMessage: `Your message was delivered to ${successResult.sent} ${successResult.sent === 1 ? "person" : "people"}.`,
      })
    : "";

  const formDisabled = isSending || inProgress;
  const recipientSummary =
    selectedTargets.length === 0
      ? "Select at least one target"
      : `${totalRecipientCount} recipient${totalRecipientCount === 1 ? "" : "s"}`;

  return (
    <>
      <div className="flex flex-col gap-2">
        {inProgress ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5">
            <p className="text-[11px] text-muted-foreground">
              {notice ?? (status ? formatBroadcastProgress(status) : null)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isSending}
              onClick={() => void resumeBroadcast()}
            >
              {isSending ? "Sending..." : "Resume"}
            </Button>
          </div>
        ) : null}

        {notice && !inProgress ? (
          <p className="px-1 text-[11px] text-muted-foreground">{notice}</p>
        ) : null}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-lg border bg-card shadow-xs"
        >
          <div className="flex flex-wrap items-center gap-1.5 border-b px-2.5 py-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              To
            </span>
            {selectedTargets.map((target) => {
              const removable = !channelLocked && !formDisabled;

              return (
                <Badge
                  key={target.id}
                  variant="outline"
                  className="border-primary/40 bg-primary/5 text-[11px] font-normal"
                >
                  {target.label}
                  <span className="text-muted-foreground">
                    {target.recipientCount}
                  </span>
                  {removable ? (
                    <button
                      type="button"
                      aria-label={`Remove ${target.label}`}
                      onClick={() => toggleTarget(target.id, false)}
                      className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  ) : null}
                </Badge>
              );
            })}
            {!channelLocked && availableTargets.length > 0 ? (
              <DropdownMenu>
                <Badge
                  variant="outline"
                  asChild
                  className="cursor-pointer border-dashed text-[11px] font-normal text-muted-foreground hover:bg-muted focus-visible:border-dashed focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <DropdownMenuTrigger
                    disabled={formDisabled}
                    aria-label="Add target"
                  >
                    Add target
                    <ChevronDownIcon className="size-3" />
                  </DropdownMenuTrigger>
                </Badge>
                <DropdownMenuContent
                  align="start"
                  side="top"
                  collisionPadding={8}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                  className="max-h-[min(16rem,var(--radix-dropdown-menu-content-available-height))] min-w-40 overscroll-y-contain"
                >
                  {availableTargets.map((target) => (
                    <DropdownMenuItem
                      key={target.id}
                      className="text-xs hover:bg-muted/60 focus:bg-muted/60 focus:text-foreground not-data-[variant=destructive]:focus:**:text-foreground"
                      onSelect={() => toggleTarget(target.id, true)}
                    >
                      {target.label}
                      <span className="ml-auto text-muted-foreground">
                        {target.recipientCount}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <div className="px-2.5 py-1">
            <Input
              id="broadcast-subject"
              name="subject"
              required
              disabled={formDisabled}
              maxLength={BROADCAST_SUBJECT_LIMIT}
              placeholder="Subject"
              className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
            <div className="border-t" />
            <Textarea
              id="broadcast-body"
              name="body"
              rows={3}
              required
              maxLength={BROADCAST_BODY_LIMIT}
              disabled={formDisabled}
              placeholder="Write your broadcast..."
              onChange={(event) => setBodyLength(event.target.value.length)}
              className="min-h-16 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t px-2.5 py-1.5">
            <p className="text-[11px] text-muted-foreground">
              {recipientSummary}
              <span aria-hidden="true"> · </span>
              {bodyLength}/{BROADCAST_BODY_LIMIT}
            </p>
            <Button
              type="submit"
              size="sm"
              className="h-7 gap-1.5 px-2.5"
              disabled={formDisabled || selectedTargets.length === 0}
            >
              {isSending ? (
                "Sending..."
              ) : (
                <>
                  Send
                  <SendHorizontalIcon className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      <AlertDialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Send broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send to {totalRecipientCount} recipient
              {totalRecipientCount === 1 ? "" : "s"}. Expand a target to review
              emails. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ConfirmTargetRecipientList targets={selectedTargets} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={successResult !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSuccessResult(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Broadcast sent</AlertDialogTitle>
            <AlertDialogDescription>
              {successDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                if (status && !status.complete) {
                  setSuccessResult(null);
                  return;
                }

                resetForm();
              }}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ConfirmTargetRecipientList({
  targets,
}: {
  targets: BroadcastTargetSummary[];
}) {
  const [expandedIds, setExpandedIds] = useState(new Set<string>());
  const [previews, setPreviews] = useState<Record<string, RecipientPreview>>(
    {},
  );

  function toggleTarget(targetId: string) {
    const expanding = !expandedIds.has(targetId);
    setExpandedIds((current) => {
      const next = new Set(current);
      if (expanding) {
        next.add(targetId);
      } else {
        next.delete(targetId);
      }
      return next;
    });

    const preview = previews[targetId];
    if (
      expanding &&
      preview?.status !== "ready" &&
      preview?.status !== "loading"
    ) {
      void loadRecipients(targetId);
    }
  }

  async function loadRecipients(targetId: string) {
    setPreviews((current) => ({
      ...current,
      [targetId]: { status: "loading" },
    }));

    try {
      const emails = await listBroadcastTargetRecipientsAction(targetId);
      setPreviews((current) => ({
        ...current,
        [targetId]: { status: "ready", emails },
      }));
    } catch (error) {
      setPreviews((current) => ({
        ...current,
        [targetId]: {
          status: "error",
          message: broadcastErrorMessage(error),
        },
      }));
    }
  }

  return (
    <div className="max-h-[min(18rem,50vh)] overflow-y-auto overscroll-y-contain rounded-md border">
      <ul aria-label="Targets">
        {targets.map((target) => {
          const expanded = expandedIds.has(target.id);
          const preview = previews[target.id];
          const panelId = `broadcast-target-recipients-${target.id.replaceAll(":", "-")}`;

          return (
            <li key={target.id} className="border-b last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggleTarget(target.id)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{target.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {preview?.status === "ready"
                    ? preview.emails.length
                    : target.recipientCount}
                </span>
              </button>
              {expanded ? (
                <div
                  id={panelId}
                  className="max-h-40 overflow-y-auto overscroll-y-contain border-t bg-muted/20"
                >
                  {!preview || preview.status === "loading" ? (
                    <div className="flex justify-center py-3">
                      <Loader2
                        aria-label="Loading recipients"
                        className="size-4 animate-spin text-muted-foreground"
                      />
                    </div>
                  ) : preview.status === "error" ? (
                    <p className="px-2.5 py-2 text-xs text-destructive">
                      {preview.message}
                    </p>
                  ) : preview.emails.length === 0 ? (
                    <p className="px-2.5 py-2 text-xs text-muted-foreground">
                      No recipients
                    </p>
                  ) : (
                    <ul aria-label={`${target.label} recipients`}>
                      {preview.emails.map((email) => (
                        <li
                          key={email}
                          className="border-b px-2.5 py-1 text-xs break-all last:border-b-0"
                        >
                          {email}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
