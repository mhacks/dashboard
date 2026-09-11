"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BROADCAST_BODY_LIMIT } from "@/lib/broadcast/config";
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

export default function BroadcastForm({
  targets,
}: {
  targets: BroadcastTargetSummary[];
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [bodyLength, setBodyLength] = useState(0);
  const [status, setStatus] = useState<BroadcastSendStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  const selectedTarget =
    targets.find((target) => target.id === targetId) ?? targets[0];

  useEffect(() => {
    void findActiveBroadcastAction().then((active) => {
      if (active && !active.complete) {
        setStatus(active);
        setTargetId(active.target);
        setNotice(
          `Resuming broadcast: ${active.sentCount} sent, ${active.failedCount} failed, ${active.pendingCount} pending.`,
        );
      }
    });
  }, []);

  async function runBroadcastLoop(initialStatus: BroadcastSendStatus) {
    let currentStatus = initialStatus;
    setStatus(currentStatus);

    for (let batch = 0; batch < 10_000; batch += 1) {
      currentStatus = await sendBroadcastBatchAction({
        broadcastId: currentStatus.broadcastId,
        cursor: currentStatus.nextCursor,
      });
      setStatus(currentStatus);
      setNotice(
        `${currentStatus.sentCount} sent, ${currentStatus.failedCount} failed, ${currentStatus.pendingCount} pending.`,
      );

      if (currentStatus.complete) {
        break;
      }
    }

    if (currentStatus.complete) {
      const params = new URLSearchParams({
        sent: String(currentStatus.sentCount),
        failed: String(currentStatus.failedCount),
      });
      router.push(`/admin/broadcast/success?${params.toString()}`);
      return;
    }

    setNotice(
      "Broadcast paused. Reload this page to resume from the last checkpoint.",
    );
  }

  async function resumeBroadcast() {
    if (!status || status.complete) {
      return;
    }

    startSending(async () => {
      try {
        await runBroadcastLoop(status);
      } catch (error) {
        setNotice(errorMessage(error));
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTarget) {
      return;
    }

    if (
      !confirm(
        `This will send to ${selectedTarget.recipientCount} recipients via ${selectedTarget.label}. Are you sure?`,
      )
    ) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const subject = String(formData.get("subject") ?? "");
    const body = String(formData.get("body") ?? "");

    startSending(async () => {
      try {
        setNotice("Starting broadcast...");
        const started = await startBroadcastAction({
          target: selectedTarget.id,
          subject,
          body,
        });
        await runBroadcastLoop(started.status);
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

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="broadcast-target">Target</Label>
          <Select
            value={targetId}
            onValueChange={setTargetId}
            disabled={isSending || inProgress || targets.length === 1}
          >
            <SelectTrigger id="broadcast-target">
              <SelectValue placeholder="Choose a target" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((target) => (
                <SelectItem key={target.id} value={target.id}>
                  {target.label} ({target.recipientCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTarget && (
            <p className="text-sm text-muted-foreground">
              {selectedTarget.description}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="broadcast-subject">Subject</Label>
          <Input
            id="broadcast-subject"
            name="subject"
            required
            disabled={isSending || inProgress}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="broadcast-body">Body</Label>
          <Textarea
            id="broadcast-body"
            name="body"
            rows={5}
            required
            maxLength={BROADCAST_BODY_LIMIT}
            disabled={isSending || inProgress}
            onChange={(event) => setBodyLength(event.target.value.length)}
          />
          <p className="text-sm text-muted-foreground">
            {bodyLength} / {BROADCAST_BODY_LIMIT}
          </p>
        </div>

        <Button
          type="submit"
          className="self-start"
          disabled={isSending || inProgress || !selectedTarget}
        >
          {isSending
            ? "Sending..."
            : `Send via ${selectedTarget?.label ?? "target"}`}
        </Button>
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
  );
}
