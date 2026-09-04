"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeftIcon,
  Loader2Icon,
  UserMinusIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  moveReservationTeam,
  unassignReservationTeam,
} from "@/lib/actions/admin-reservations.server.actions";
import type { AdminReservationAssignmentsData } from "@/lib/queries/admin-reservations";
import type { TableWithTeam } from "@/lib/reservation/types";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JudgingMap } from "@/components/reservation/judging-map";

type AssignmentTeam = AdminReservationAssignmentsData["teams"][number];

type MoveIntent = {
  kind: "assign" | "move" | "swap" | "displace";
  team: AssignmentTeam;
  source: TableWithTeam | null;
  destination: TableWithTeam;
  displacedTeamName: string | null;
};

type UnassignIntent = {
  team: AssignmentTeam;
  source: TableWithTeam;
};

const INTENT_LABELS: Record<MoveIntent["kind"], string> = {
  assign: "Assign team",
  move: "Move team",
  swap: "Swap teams",
  displace: "Displace team",
};

function intentTitle(intent: MoveIntent): string {
  switch (intent.kind) {
    case "assign":
      return `Assign ${intent.team.name}?`;
    case "move":
      return `Move ${intent.team.name}?`;
    case "swap":
      return `Swap ${intent.team.name} and ${intent.displacedTeamName}?`;
    case "displace":
      return `Displace ${intent.displacedTeamName}?`;
  }
}

function intentDescription(intent: MoveIntent): string {
  const destination = `Table ${intent.destination.number}`;

  switch (intent.kind) {
    case "assign":
      return `${intent.team.name} is currently unassigned and will be assigned to ${destination}.`;
    case "move":
      return `${intent.team.name} will move from Table ${intent.source!.number} to empty ${destination}.`;
    case "swap":
      return `${intent.team.name} will move from Table ${intent.source!.number} to ${destination}; ${intent.displacedTeamName} will move from ${destination} to Table ${intent.source!.number}.`;
    case "displace":
      return `${intent.team.name} will be assigned to ${destination}; ${intent.displacedTeamName} will be removed from ${destination} and become unassigned.`;
  }
}

export function AssignmentManagement({
  event,
  teams,
  tables,
}: AdminReservationAssignmentsData) {
  const router = useRouter();
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? "");
  const [moveIntent, setMoveIntent] = useState<MoveIntent | null>(null);
  const [unassignIntent, setUnassignIntent] = useState<UnassignIntent | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTeam =
    teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;
  const currentTable =
    tables.find((table) => table.reservedByTeamId === selectedTeam?.id) ?? null;
  const isArchived = event.status === "archived";
  const assignedCount = tables.filter((table) => table.reservedByTeamId).length;

  function selectTeam(teamId: string) {
    if (isPending) return;
    setSelectedTeamId(teamId);
    setMoveIntent(null);
    setUnassignIntent(null);
    setActionError(null);
  }

  function prepareMove(destination: TableWithTeam) {
    if (!selectedTeam || isArchived || isPending) return;
    if (destination.reservedByTeamId === selectedTeam.id) return;

    const displacedTeamName = destination.reservedByTeamId
      ? (destination.reservedByTeamName ??
        teams.find((team) => team.id === destination.reservedByTeamId)?.name ??
        "Unknown team")
      : null;
    const kind: MoveIntent["kind"] = currentTable
      ? displacedTeamName
        ? "swap"
        : "move"
      : displacedTeamName
        ? "displace"
        : "assign";

    setActionError(null);
    setMoveIntent({
      kind,
      team: selectedTeam,
      source: currentTable,
      destination,
      displacedTeamName,
    });
  }

  function runMove() {
    if (!moveIntent || isArchived) return;
    setActionError(null);

    startTransition(async () => {
      try {
        const result = await moveReservationTeam({
          eventId: event.id,
          teamId: moveIntent.team.id,
          tableId: moveIntent.destination.id,
          expectedSourceTableId: moveIntent.source?.id ?? null,
          expectedSourceTableNumber: moveIntent.source?.number ?? null,
          expectedDestinationTableNumber: moveIntent.destination.number,
          expectedDestinationTeamId:
            moveIntent.destination.reservedByTeamId ?? null,
        });
        if (!result.ok) {
          setActionError(result.error);
          return;
        }

        toast.success(result.message);
        setMoveIntent(null);
        router.refresh();
      } catch {
        const message = "Could not update the assignment. Try again.";
        setActionError(message);
        toast.error(message);
      }
    });
  }

  function runUnassign() {
    if (!unassignIntent || isArchived) return;
    setActionError(null);

    startTransition(async () => {
      try {
        const result = await unassignReservationTeam({
          eventId: event.id,
          teamId: unassignIntent.team.id,
          expectedSourceTableId: unassignIntent.source.id,
          expectedSourceTableNumber: unassignIntent.source.number,
        });
        if (!result.ok) {
          setActionError(result.error);
          return;
        }

        toast.success(result.message);
        setUnassignIntent(null);
        router.refresh();
      } catch {
        const message = "Could not unassign the team. Try again.";
        setActionError(message);
        toast.error(message);
      }
    });
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Assignment map</CardTitle>
                <CardDescription>
                  Select a team, then choose its destination table.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{tables.length} tables</Badge>
                <Badge variant="secondary">{assignedCount} assigned</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <JudgingMap
              tables={tables}
              selectedTableId={moveIntent?.destination.id ?? null}
              teamId={selectedTeam?.id ?? null}
              onSelect={prepareMove}
              disabled={isArchived || isPending || !selectedTeam}
              mode="admin"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team assignment</CardTitle>
            <CardDescription>
              {isArchived
                ? "Archived events are read-only. Restore the event to change assignments."
                : "Moving onto an occupied table will swap or displace its current team."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="assignment-team"
                className="text-sm font-medium text-foreground"
              >
                Team
              </label>
              <Select
                value={selectedTeam?.id}
                onValueChange={selectTeam}
                disabled={teams.length === 0 || isPending}
              >
                <SelectTrigger id="assignment-team" aria-label="Team">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Current assignment</p>
              {selectedTeam ? (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="font-medium">{selectedTeam.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentTable
                      ? `Table ${currentTable.number}`
                      : "Unassigned"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No teams are available for assignment.
                </p>
              )}
            </div>

            {isArchived ? (
              <Badge variant="destructive" className="w-fit">
                Read-only
              </Badge>
            ) : null}
          </CardContent>
          {selectedTeam && currentTable ? (
            <CardFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isArchived || isPending}
                aria-label={`Unassign ${selectedTeam.name}`}
                onClick={() => {
                  setActionError(null);
                  setUnassignIntent({
                    team: selectedTeam,
                    source: currentTable,
                  });
                }}
              >
                <UserMinusIcon data-icon="inline-start" />
                Unassign {selectedTeam.name}
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      </div>

      <AlertDialog
        open={moveIntent !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setMoveIntent(null);
            setActionError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <ArrowRightLeftIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {moveIntent ? intentTitle(moveIntent) : "Update assignment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {moveIntent
                ? intentDescription(moveIntent)
                : "Confirm this assignment change."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError ? (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || isArchived}
              onClick={(clickEvent) => {
                clickEvent.preventDefault();
                runMove();
              }}
            >
              {isPending ? (
                <Loader2Icon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : null}
              {moveIntent ? INTENT_LABELS[moveIntent.kind] : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={unassignIntent !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setUnassignIntent(null);
            setActionError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <UsersRoundIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Unassign {unassignIntent?.team.name ?? "this team"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {unassignIntent
                ? `${unassignIntent.team.name} will be removed from Table ${unassignIntent.source.number} and become unassigned.`
                : "The selected team will become unassigned."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError ? (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending || isArchived}
              onClick={(clickEvent) => {
                clickEvent.preventDefault();
                runUnassign();
              }}
            >
              {isPending ? (
                <Loader2Icon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : null}
              Unassign team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
