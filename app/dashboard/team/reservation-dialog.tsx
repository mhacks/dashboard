"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { JudgingMap } from "./judging-map";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  randomlyAssignTable,
  reserveTable,
  type ActionResult,
} from "@/lib/actions/reservation";
import type { ParticipantReservationChoice } from "@/lib/db/queries/reservation";
import type { TableWithTeam } from "@/lib/reservation/types";

const SELECT_CLASS =
  "w-full rounded-[2px] border border-ui-line-strong bg-ui-paper px-3 py-2 font-red-hat-mono text-[13px] text-ui-ink focus:outline-2 focus:outline-offset-2 focus:outline-ui-ink";

export function ReservationDialog({
  buttonClassName,
  primaryClassName,
  teamId,
  events,
  tablesByEventId,
}: {
  buttonClassName: string;
  primaryClassName: string;
  teamId: string;
  events: ParticipantReservationChoice[];
  tablesByEventId: Record<string, TableWithTeam[]>;
}) {
  const router = useRouter();
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "reserve" | "random" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const event = events.find((item) => item.id === eventId) ?? events[0];
  const tables = event ? (tablesByEventId[event.id] ?? []) : [];
  const myTable =
    tables.find((table) => table.reservedByTeamId === teamId) ?? null;
  const selectedTable =
    tables.find((table) => table.id === selectedTableId) ?? null;
  const canReserve = Boolean(event && event.state === "open" && !myTable);
  const buttonLabel =
    events.length === 1 && myTable
      ? `Table ${myTable.number}`
      : "Choose a table";

  function run(
    actionName: "reserve" | "random",
    action: () => Promise<ActionResult>,
  ) {
    setPendingAction(actionName);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message ?? "Saved.");
          setSelectedTableId(null);
          router.refresh();
        } else {
          toast.error(result.error);
          router.refresh();
        }
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <Dialog
      onOpenChange={() => {
        setSelectedTableId(null);
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className={buttonClassName}>
          {buttonLabel}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2px] border-ui-line bg-ui-paper text-ui-ink ring-ui-line sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-red-hat-mono text-lg font-bold tracking-[-0.01em]">
            Reserve a table
          </DialogTitle>
          <DialogDescription className="text-ui-ink-soft">
            {events.length === 0
              ? "There are no reservation events right now."
              : statusCopy(event?.state ?? "closed", myTable?.number ?? null)}
          </DialogDescription>
        </DialogHeader>

        {events.length > 1 && event ? (
          <select
            value={event.id}
            onChange={(change) => {
              setEventId(change.target.value);
              setSelectedTableId(null);
            }}
            className={SELECT_CLASS}
            aria-label="Event"
          >
            {events.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : null}

        {events.length > 0 ? (
          <JudgingMap
            tables={tables}
            selectedTableId={selectedTableId}
            teamId={teamId}
            onSelect={(table) => {
              if (!canReserve) return;
              setSelectedTableId(table.id);
            }}
            disabled={isPending || !canReserve}
          />
        ) : null}

        {canReserve ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending || !selectedTable}
              onClick={() => {
                if (!selectedTable) return;
                run("reserve", () =>
                  reserveTable({ tableId: selectedTable.id }),
                );
              }}
              className={primaryClassName}
            >
              {pendingAction === "reserve"
                ? "Saving…"
                : selectedTable
                  ? `Reserve table ${selectedTable.number}`
                  : "Select a table"}
            </button>
            <button
              type="button"
              disabled={isPending || !event}
              onClick={() => {
                if (!event) return;
                run("random", () => randomlyAssignTable({ eventId: event.id }));
              }}
              className={buttonClassName}
            >
              {pendingAction === "random" ? "Assigning…" : "Assign randomly"}
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function statusCopy(
  state: ParticipantReservationChoice["state"],
  tableNumber: number | null,
): string {
  if (tableNumber !== null) {
    return `Your team has table ${tableNumber}. Reservations are final.`;
  }
  if (state === "open") return "Pick an open table. Reservations are final.";
  if (state === "scheduled") return "Reservations have not opened yet.";
  return "Reservations are closed.";
}
