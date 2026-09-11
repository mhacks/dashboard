"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type {
  BroadcastSendStatus,
  BroadcastTargetSummary,
} from "@/lib/broadcast/types";
import { SendHorizontalIcon } from "lucide-react";
import { findActiveBroadcastAction, startBroadcastAction } from "./actions";
import { runBroadcastLoop } from "./run-broadcast-loop";
import { useRecipientSelection } from "./use-recipient-selection";

type BroadcastDraft = {
  subject: string;
  body: string;
};

export default function BroadcastForm({
  targets,
  channelTargetId = null,
}: {
  targets: BroadcastTargetSummary[];
  channelTargetId?: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const channelLocked = Boolean(channelTargetId);
  const defaultTargetIds = channelTargetId
    ? [channelTargetId]
    : targets.map((target) => target.id);
  const {
    selected: selectedTargetIds,
    toggle: toggleTarget,
    setRecipients: setSelectedTargetIds,
  } = useRecipientSelection(defaultTargetIds);
  const [bodyLength, setBodyLength] = useState(0);
  const [status, setStatus] = useState<BroadcastSendStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<BroadcastDraft | null>(null);
  const [successResult, setSuccessResult] = useState<{
    sent: number;
    failed: number;
  } | null>(null);
  const [isSending, startSending] = useTransition();

  const selectedTargets = targets.filter((target) =>
    selectedTargetIds.has(target.id),
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
          router.refresh();
        }
      } catch (error) {
        setNotice(broadcastErrorMessage(error));
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
            return;
          }

          totalSent += finalStatus.sentCount;
          totalFailed += finalStatus.failedCount;
        }

        setSuccessResult({ sent: totalSent, failed: totalFailed });
        router.refresh();
      } catch (error) {
        setNotice(broadcastErrorMessage(error));
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
        successMessage: `Your message was delivered to ${successResult.sent} hackers.`,
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
            {(channelLocked
              ? targets.filter((target) => target.id === channelTargetId)
              : targets
            ).map((target) => {
              const checked = selectedTargetIds.has(target.id);

              return (
                <button
                  key={target.id}
                  type="button"
                  disabled={formDisabled || channelLocked}
                  onClick={() => toggleTarget(target.id, !checked)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                    checked
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground",
                    (formDisabled || channelLocked) &&
                      "cursor-default opacity-100",
                    formDisabled &&
                      !channelLocked &&
                      "cursor-not-allowed opacity-60",
                  )}
                >
                  {target.label}
                  <span className="ml-1 text-muted-foreground">
                    {target.recipientCount}
                  </span>
                </button>
              );
            })}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTargets.length === 1
                ? `This will send to ${selectedTargets[0].recipientCount} recipients via ${selectedTargets[0].label}.`
                : `This will send to ${totalRecipientCount} recipients across ${selectedTargets.length} targets: ${selectedTargets.map((target) => target.label).join(", ")}.`}{" "}
              Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
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
