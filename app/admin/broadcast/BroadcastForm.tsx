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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BROADCAST_BODY_LIMIT } from "@/lib/broadcast/config";
import { cn } from "@/lib/utils";
import type {
  BroadcastSendStatus,
  BroadcastTargetSummary,
} from "@/lib/broadcast/types";
import {
  findActiveBroadcastAction,
  sendBroadcastBatchAction,
  startBroadcastAction,
} from "./actions";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function broadcastProgressKey(status: BroadcastSendStatus) {
  return `${status.nextCursor}:${status.sentCount}:${status.failedCount}`;
}

type BroadcastDraft = {
  subject: string;
  body: string;
};

export default function BroadcastForm({
  targets,
}: {
  targets: BroadcastTargetSummary[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>(() =>
    targets.map((target) => target.id),
  );
  const [bodyLength, setBodyLength] = useState(0);
  const [status, setStatus] = useState<BroadcastSendStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<BroadcastDraft | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    sent: number;
    failed: number;
  } | null>(null);
  const [isSending, startSending] = useTransition();

  const selectedTargets = targets.filter((target) =>
    selectedTargetIds.includes(target.id),
  );
  const totalRecipientCount = selectedTargets.reduce(
    (sum, target) => sum + target.recipientCount,
    0,
  );

  useEffect(() => {
    void findActiveBroadcastAction().then((active) => {
      if (active && !active.complete) {
        setStatus(active);
        setSelectedTargetIds([active.target]);
        setNotice(
          `Resuming broadcast: ${active.sentCount} sent, ${active.failedCount} failed, ${active.pendingCount} pending.`,
        );
      }
    });
  }, []);

  function toggleTarget(targetId: string, checked: boolean) {
    setSelectedTargetIds((current) => {
      if (checked) {
        return current.includes(targetId) ? current : [...current, targetId];
      }

      return current.filter((id) => id !== targetId);
    });
  }

  async function runBroadcastLoop(
    initialStatus: BroadcastSendStatus,
    targetLabel?: string,
  ): Promise<BroadcastSendStatus> {
    let currentStatus = initialStatus;
    setStatus(currentStatus);

    for (let batch = 0; batch < 10_000; batch += 1) {
      const progressBefore = broadcastProgressKey(currentStatus);

      currentStatus = await sendBroadcastBatchAction({
        broadcastId: currentStatus.broadcastId,
        cursor: currentStatus.nextCursor,
      });
      setStatus(currentStatus);
      setNotice(
        targetLabel
          ? `${targetLabel}: ${currentStatus.sentCount} sent, ${currentStatus.failedCount} failed, ${currentStatus.pendingCount} pending.`
          : `${currentStatus.sentCount} sent, ${currentStatus.failedCount} failed, ${currentStatus.pendingCount} pending.`,
      );

      if (currentStatus.complete) {
        return currentStatus;
      }

      if (broadcastProgressKey(currentStatus) === progressBefore) {
        setNotice(
          "Broadcast paused while another send is in progress or the lease is active. Reload this page to resume from the last checkpoint.",
        );
        return currentStatus;
      }
    }

    setNotice(
      "Broadcast paused. Reload this page to resume from the last checkpoint.",
    );
    return currentStatus;
  }

  async function resumeBroadcast() {
    if (!status || status.complete) {
      return;
    }

    startSending(async () => {
      try {
        const finalStatus = await runBroadcastLoop(status);
        if (finalStatus.complete) {
          setSuccessResult({
            sent: finalStatus.sentCount,
            failed: finalStatus.failedCount,
          });
          setSuccessOpen(true);
          router.refresh();
        }
      } catch (error) {
        setNotice(errorMessage(error));
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
    setSelectedTargetIds(targets.map((target) => target.id));
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
    setConfirmOpen(true);
  }

  function confirmSend() {
    if (selectedTargets.length === 0 || !draft) {
      return;
    }

    startSending(async () => {
      try {
        let totalSent = 0;
        let totalFailed = 0;

        for (const target of selectedTargets) {
          setNotice(`Starting broadcast to ${target.label}...`);
          const started = await startBroadcastAction({
            target: target.id,
            subject: draft.subject,
            body: draft.body,
          });
          const finalStatus = await runBroadcastLoop(
            started.status,
            target.label,
          );

          if (!finalStatus.complete) {
            return;
          }

          totalSent += finalStatus.sentCount;
          totalFailed += finalStatus.failedCount;
        }

        setSuccessResult({ sent: totalSent, failed: totalFailed });
        setSuccessOpen(true);
        router.refresh();
      } catch (error) {
        setNotice(errorMessage(error));
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

  const successDescription =
    successResult && successResult.failed > 0
      ? `Delivery finished with ${successResult.sent} sent and ${successResult.failed} failed.`
      : `Your message was delivered to ${successResult?.sent ?? 0} hackers.`;

  return (
    <>
      <div className="flex flex-col gap-4">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="broadcast-subject">Subject</Label>
            <Input
              id="broadcast-subject"
              name="subject"
              required
              disabled={isSending || inProgress}
              placeholder="Message subject"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="broadcast-body">Message</Label>
            <Textarea
              id="broadcast-body"
              name="body"
              rows={4}
              required
              maxLength={BROADCAST_BODY_LIMIT}
              disabled={isSending || inProgress}
              placeholder="Write your broadcast..."
              onChange={(event) => setBodyLength(event.target.value.length)}
            />
            <p className="text-xs text-muted-foreground">
              {bodyLength} / {BROADCAST_BODY_LIMIT}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">To</Label>
            <div className="flex flex-wrap gap-2">
              {targets.map((target) => {
                const checked = selectedTargetIds.includes(target.id);
                const disabled = isSending || inProgress;

                return (
                  <label
                    key={target.id}
                    htmlFor={`broadcast-target-${target.id}`}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      checked
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground",
                      disabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <Checkbox
                      id={`broadcast-target-${target.id}`}
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleTarget(target.id, value === true)
                      }
                      disabled={disabled}
                      className="size-3.5"
                    />
                    <span>
                      {target.label}{" "}
                      <span className="text-muted-foreground">
                        ({target.recipientCount})
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {selectedTargets.length === 0
                ? "Select at least one target."
                : `${totalRecipientCount} recipient${totalRecipientCount === 1 ? "" : "s"} selected`}
            </p>
            <Button
              type="submit"
              disabled={isSending || inProgress || selectedTargets.length === 0}
            >
              {isSending
                ? "Sending..."
                : selectedTargets.length === 1
                  ? `Send to ${selectedTargets[0].label}`
                  : `Send to ${selectedTargets.length} targets`}
            </Button>
          </div>
        </form>

        {inProgress && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {notice ??
                `${status?.sentCount ?? 0} sent, ${status?.failedCount ?? 0} failed, ${status?.pendingCount ?? 0} pending.`}
            </p>
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={isSending}
              onClick={() => void resumeBroadcast()}
            >
              {isSending ? "Sending..." : "Resume broadcast"}
            </Button>
          </div>
        )}

        {notice && !inProgress && (
          <p className="text-sm text-muted-foreground">{notice}</p>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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

      <AlertDialog open={successOpen} onOpenChange={setSuccessOpen}>
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
              Send another
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
