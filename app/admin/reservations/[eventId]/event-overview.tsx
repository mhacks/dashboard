"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  Loader2Icon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  archiveReservationEvent,
  deleteReservationEvent,
  restoreReservationEvent,
} from "@/lib/actions/admin-reservations.server.actions";
import type { AdminReservationEventDetail } from "@/lib/queries/admin-reservations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReservationEventForm } from "../reservation-event-form";

type LifecycleOperation = "archive" | "restore" | "delete";

const STATUS_LABELS: Record<AdminReservationEventDetail["status"], string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  archived: "Archived",
};

const STATUS_VARIANTS: Record<
  AdminReservationEventDetail["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  open: "default",
  closed: "secondary",
  archived: "destructive",
};

export function EventOverview({
  event,
}: {
  event: AdminReservationEventDetail;
}) {
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isArchived = event.status === "archived";

  function handleDialogChange(setOpen: (open: boolean) => void, open: boolean) {
    if (isPending && !open) return;
    setOpen(open);
    if (open) setLifecycleError(null);
  }

  function runLifecycleAction(
    operation: LifecycleOperation,
    close: () => void,
  ) {
    setLifecycleError(null);

    startTransition(async () => {
      try {
        const result =
          operation === "archive"
            ? await archiveReservationEvent(event.id)
            : operation === "restore"
              ? await restoreReservationEvent(event.id)
              : await deleteReservationEvent(event.id);

        if (!result.ok) {
          setLifecycleError(result.error);
          return;
        }

        toast.success(result.message);
        close();

        if (operation === "delete") {
          router.push("/admin/reservations");
        }
        router.refresh();
      } catch {
        setLifecycleError(`Could not ${operation} the event. Try again.`);
      }
    });
  }

  function handleUpdated(message: string) {
    toast.success(message);
    router.refresh();
  }

  const pendingIcon = isPending ? (
    <Loader2Icon data-icon="inline-start" className="animate-spin" />
  ) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>
            {isArchived
              ? "Archived events are read-only. Restore this event to edit its details or schedule."
              : "Update participant-facing details, lifecycle status, and the reservation window."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReservationEventForm
            key={event.updatedAt.toISOString()}
            event={event}
            disabled={isArchived}
            onSuccess={handleUpdated}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
          <CardDescription>
            Archive events instead of deleting them when you may need their
            configuration later.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Current status</span>
            <Badge variant={STATUS_VARIANTS[event.status]}>
              {STATUS_LABELS[event.status]}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Tables</span>
            <span>{event.tableCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Assigned teams</span>
            <span>{event.assignedCount}</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {!isArchived ? (
            <AlertDialog
              open={archiveOpen}
              onOpenChange={(open) => handleDialogChange(setArchiveOpen, open)}
            >
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  <ArchiveIcon data-icon="inline-start" />
                  Archive event
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <ArchiveIcon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Archive this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Participants will no longer see this event, and organizer
                    editing, table changes, and assignments will be read-only
                    until it is restored.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {lifecycleError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {lifecycleError}
                  </p>
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isPending}
                    onClick={(clickEvent) => {
                      clickEvent.preventDefault();
                      runLifecycleAction("archive", () =>
                        setArchiveOpen(false),
                      );
                    }}
                  >
                    {pendingIcon}
                    Archive event
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog
              open={restoreOpen}
              onOpenChange={(open) => handleDialogChange(setRestoreOpen, open)}
            >
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  <ArchiveRestoreIcon data-icon="inline-start" />
                  Restore event
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <ArchiveRestoreIcon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Restore this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The event will return as closed. It will be participant
                    visible but remain unavailable for reservations until you
                    change its status.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {lifecycleError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {lifecycleError}
                  </p>
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isPending}
                    onClick={(clickEvent) => {
                      clickEvent.preventDefault();
                      runLifecycleAction("restore", () =>
                        setRestoreOpen(false),
                      );
                    }}
                  >
                    {pendingIcon}
                    Restore event
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <AlertDialog
            open={deleteOpen}
            onOpenChange={(open) => handleDialogChange(setDeleteOpen, open)}
          >
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={isPending}>
                <Trash2Icon data-icon="inline-start" />
                Delete event
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-destructive/10 text-destructive">
                  <TriangleAlertIcon />
                </AlertDialogMedia>
                <AlertDialogTitle>
                  Permanently delete this event?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the event and its empty tables permanently.
                  {event.assignedCount > 0
                    ? ` Deletion is blocked while ${event.assignedCount} ${
                        event.assignedCount === 1 ? "team is" : "teams are"
                      } assigned.`
                    : " Audit history will remain available in the global log."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {lifecycleError ? (
                <p role="alert" className="text-sm text-destructive">
                  {lifecycleError}
                </p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isPending}
                  onClick={(clickEvent) => {
                    clickEvent.preventDefault();
                    runLifecycleAction("delete", () => setDeleteOpen(false));
                  }}
                >
                  {pendingIcon}
                  Delete event
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
