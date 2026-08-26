"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CalendarPlusIcon,
  Clock3Icon,
  MapPinnedIcon,
  TablePropertiesIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminReservationEventListItem } from "@/lib/queries/admin-reservations";
import type { ReservationEventStatus } from "@/lib/reservation/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ReservationEventForm,
  useClientHydrated,
} from "./reservation-event-form";

const STATUS_LABELS: Record<ReservationEventStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  archived: "Archived",
};

const STATUS_VARIANTS: Record<
  ReservationEventStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  open: "default",
  closed: "secondary",
  archived: "destructive",
};

export function formatReservationDateTime(
  value: Date | string | null,
  timeZone?: string,
) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

function reservationWindowSummary(
  event: AdminReservationEventListItem,
  hydrated: boolean,
  state: ReservationWindowPresentation,
) {
  if (!event.reservationsOpenAt && !event.reservationsCloseAt) {
    return "No reservation window";
  }
  if (!hydrated) return "Loading local times…";

  if (state.boundary && state.boundaryLabel) {
    const boundary = formatReservationDateTime(state.boundary);
    return boundary
      ? `${state.boundaryLabel} ${boundary}`
      : "Invalid reservation window";
  }

  const opensAt = formatReservationDateTime(event.reservationsOpenAt);
  const closesAt = formatReservationDateTime(event.reservationsCloseAt);

  if (opensAt && closesAt) return `Opens ${opensAt} · Closes ${closesAt}`;
  if (opensAt) return `Opens ${opensAt} · No closing time`;
  if (closesAt) return `Closes ${closesAt}`;
  return "Invalid reservation window";
}

type ReservationWindowPresentation = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  boundary?: Date;
  boundaryLabel?: "Opens" | "Closes" | "Closed";
};

function reservationWindowPresentation(
  event: AdminReservationEventListItem,
): ReservationWindowPresentation {
  const availability = event.reservationAvailability;

  if (event.status === "open") {
    if (availability.state === "scheduled") {
      return {
        label: "Scheduled",
        variant: "outline",
        boundary: availability.boundary,
        boundaryLabel: "Opens",
      };
    }
    if (availability.state === "open") {
      return {
        label: "Open",
        variant: "default",
        ...(event.reservationsCloseAt
          ? {
              boundary: event.reservationsCloseAt,
              boundaryLabel: "Closes" as const,
            }
          : {}),
      };
    }
    return {
      label: "Closed by window",
      variant: "secondary",
      ...(event.reservationsCloseAt
        ? {
            boundary: event.reservationsCloseAt,
            boundaryLabel: "Closed" as const,
          }
        : {}),
    };
  }

  if (event.status === "closed") {
    return { label: "Closed", variant: "secondary" };
  }
  if (event.status === "archived") {
    return { label: "Archived", variant: "destructive" };
  }
  return { label: "Not open", variant: "outline" };
}

function EventCard({
  event,
  hydrated,
}: {
  event: AdminReservationEventListItem;
  hydrated: boolean;
}) {
  const startsAt = event.startsAt
    ? hydrated
      ? (formatReservationDateTime(event.startsAt) ?? "Invalid start time")
      : "Loading local time…"
    : "Not scheduled";
  const reservationWindowState = reservationWindowPresentation(event);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link
            href={`/admin/reservations/${event.id}`}
            className="hover:underline hover:underline-offset-4"
          >
            {event.name}
          </Link>
        </CardTitle>
        <CardDescription>Reservation event</CardDescription>
        <CardAction className="flex flex-wrap justify-end gap-2">
          <Badge variant={STATUS_VARIANTS[event.status]}>
            {STATUS_LABELS[event.status]}
          </Badge>
          <Badge variant={reservationWindowState.variant}>
            {reservationWindowState.label}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="flex gap-3">
            <Clock3Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="font-medium">Starts</dt>
              <dd className="text-muted-foreground">{startsAt}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPinnedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="font-medium">Reservation window</dt>
              <dd className="text-muted-foreground">
                {reservationWindowSummary(
                  event,
                  hydrated,
                  reservationWindowState,
                )}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <TablePropertiesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="font-medium">Tables</dt>
              <dd className="text-muted-foreground">
                {event.tableCount} {event.tableCount === 1 ? "table" : "tables"}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <UsersRoundIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="font-medium">Assignments</dt>
              <dd className="text-muted-foreground">
                {event.assignedCount} assigned
              </dd>
            </div>
          </div>
        </dl>
      </CardContent>

      <CardFooter className="justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/reservations/${event.id}`}>
            Open event
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ReservationEventList({
  initialEvents,
}: {
  initialEvents: AdminReservationEventListItem[];
}) {
  const router = useRouter();
  const hydrated = useClientHydrated();
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const createPendingRef = useRef(false);

  function handleCreated(message: string) {
    toast.success(message);
    setCreateOpen(false);
    router.refresh();
  }

  function handleCreatePendingChange(pending: boolean) {
    createPendingRef.current = pending;
    setCreatePending(pending);
  }

  function handleCreateOpenChange(open: boolean) {
    if (createPendingRef.current) return;
    setCreateOpen(open);
  }

  return (
    <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
      <section className="flex flex-col gap-4">
        {initialEvents.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No reservation events yet</CardTitle>
              <CardDescription>
                Create an event to configure its schedule, tables, and team
                assignments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                New events begin as drafts and stay hidden from participants
                until you open them.
              </p>
            </CardContent>
            <CardFooter>
              <DialogTrigger asChild>
                <Button disabled={createPending}>
                  <CalendarPlusIcon data-icon="inline-start" />
                  Create event
                </Button>
              </DialogTrigger>
            </CardFooter>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {initialEvents.length}{" "}
                {initialEvents.length === 1 ? "event" : "events"}
              </p>
              <DialogTrigger asChild>
                <Button disabled={createPending}>
                  <CalendarPlusIcon data-icon="inline-start" />
                  Create event
                </Button>
              </DialogTrigger>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {initialEvents.map((event) => (
                <EventCard key={event.id} event={event} hydrated={hydrated} />
              ))}
            </div>
          </>
        )}
      </section>

      <DialogContent
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!createPending}
        onEscapeKeyDown={(event) => {
          if (createPendingRef.current) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (createPendingRef.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (createPendingRef.current) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Create reservation event</DialogTitle>
          <DialogDescription>
            Configure the event details and optional reservation window. You can
            add tables after creating it.
          </DialogDescription>
        </DialogHeader>
        <ReservationEventForm
          onPendingChange={handleCreatePendingChange}
          onSuccess={handleCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
