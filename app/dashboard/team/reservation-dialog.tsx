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
import type { ParticipantReservationSnapshot } from "@/lib/db/queries/reservation";
import type { TableWithTeam } from "@/lib/reservation/types";

export function ReservationDialog({
  buttonClassName,
  primaryClassName,
  columns,
  rows,
  teamId,
  state,
  tables,
}: {
  buttonClassName: string;
  primaryClassName: string;
  columns: number;
  rows: number;
  teamId: string;
  state: ParticipantReservationSnapshot["state"];
  tables: TableWithTeam[];
}) {
  const router = useRouter();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "reserve" | "random" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const myTable =
    tables.find((table) => table.reservedByTeamId === teamId) ?? null;
  const selectedTable =
    tables.find((table) => table.id === selectedTableId) ?? null;
  const canChoose = state === "open";
  const moving = Boolean(myTable);
  const buttonLabel = myTable
    ? `Table ${myTable.number}`
    : state === "open"
      ? "Choose a table"
      : state === "scheduled"
        ? "Not open yet"
        : "Locked";

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
            {statusCopy(state, myTable?.number ?? null)}
          </DialogDescription>
        </DialogHeader>

        <JudgingMap
          tables={tables}
          columns={columns}
          rows={rows}
          selectedTableId={selectedTableId}
          teamId={teamId}
          onSelect={(table) => {
            if (!canChoose || table.reservedByTeamId) return;
            setSelectedTableId(table.id);
          }}
          disabled={isPending || !canChoose}
        />

        {canChoose ? (
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
                  ? moving
                    ? `Move to table ${selectedTable.number}`
                    : `Reserve table ${selectedTable.number}`
                  : "Select a table"}
            </button>
            {moving ? null : (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  run("random", () => randomlyAssignTable());
                }}
                className={buttonClassName}
              >
                {pendingAction === "random" ? "Assigning…" : "Assign randomly"}
              </button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function statusCopy(
  state: ParticipantReservationSnapshot["state"],
  tableNumber: number | null,
): string {
  if (tableNumber !== null) {
    if (state === "open") {
      return `Your team has table ${tableNumber}. Pick an open table to move.`;
    }
    if (state === "scheduled") {
      return `Your team has table ${tableNumber}. Reservation has not opened yet.`;
    }
    return `Your team has table ${tableNumber}. Reservation is locked.`;
  }
  if (state === "open") return "Pick an open table.";
  if (state === "scheduled") return "Table reservation has not opened yet.";
  return "Table reservation is locked.";
}
