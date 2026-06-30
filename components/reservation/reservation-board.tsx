"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Shuffle, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventPicker } from "@/components/reservation/event-picker";
import { JudgingMap } from "@/components/reservation/judging-map";
import {
  adminMoveTeamToTable,
  randomlyAssignTable,
  reserveTable,
} from "@/lib/actions/reservation";
import type {
  Event,
  SignedInUser,
  TableWithTeam,
  Team,
} from "@/lib/db/queries/reservation";

export function ReservationBoard({
  events,
  user,
  teams,
  tables,
  selectedEventId,
}: {
  events: Event[];
  user: SignedInUser | null;
  teams: Team[];
  tables: TableWithTeam[];
  selectedEventId: string;
}) {
  const router = useRouter();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [adminTeamId, setAdminTeamId] = useState("");
  const [pendingAdminMove, setPendingAdminMove] =
    useState<TableWithTeam | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAdmin = user?.isAdmin ?? false;
  const teamId = isAdmin ? null : (user?.teamId ?? null);
  const myTable =
    tables.find((t) => teamId && t.reservedByTeamId === teamId) ?? null;
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;
  const hasReservation = myTable !== null;
  const canReserve = !isAdmin && Boolean(teamId) && !hasReservation;

  const total = tables.length;
  const reservedCount = tables.filter((t) => t.reservedByTeamId).length;
  const openCount = total - reservedCount;

  const adminTeamName = teams.find((t) => t.id === adminTeamId)?.name ?? "team";
  const adminTeamCurrentTable = adminTeamId
    ? (tables.find((t) => t.reservedByTeamId === adminTeamId) ?? null)
    : null;

  function handleSelectTable(table: TableWithTeam) {
    if (isAdmin) {
      if (!adminTeamId) {
        toast.error("Select a team first.");
        return;
      }
      if (table.reservedByTeamId === adminTeamId) return;
      setPendingAdminMove(table);
      return;
    }

    if (!canReserve) return;
    setSelectedTableId(table.id);
  }

  function handleConfirmAdminMove() {
    if (!pendingAdminMove || !adminTeamId) return;

    startTransition(async () => {
      const result = await adminMoveTeamToTable({
        teamId: adminTeamId,
        tableId: pendingAdminMove.id,
      });
      if (result.ok) {
        toast.success(result.message);
        setPendingAdminMove(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReserve() {
    if (!canReserve) {
      toast.error("Your team already has a table for this event.");
      return;
    }
    if (!selectedTable) {
      toast.error("Select a table on the map first.");
      return;
    }
    startTransition(async () => {
      const result = await reserveTable({ tableId: selectedTable.id });
      if (result.ok) {
        toast.success(result.message);
        setSelectedTableId(null);
        router.refresh();
      } else {
        toast.error(result.error);
        router.refresh();
      }
    });
  }

  function handleRandom() {
    if (!canReserve) {
      toast.error("Your team already has a table for this event.");
      return;
    }
    startTransition(async () => {
      const result = await randomlyAssignTable({ eventId: selectedEventId });
      if (result.ok) {
        toast.success(result.message);
        setSelectedTableId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">Judging area</CardTitle>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Badge variant="outline">{openCount} open</Badge>
                <Badge variant="secondary">{reservedCount} reserved</Badge>
              </div>
            </div>
            <CardDescription>
              {isAdmin
                ? "Select a team, then click a table to move or swap them."
                : hasReservation
                  ? "Your table is locked in for this event."
                  : "Tap an open table to select it, then reserve."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JudgingMap
              tables={tables}
              selectedTableId={selectedTableId}
              teamId={isAdmin ? adminTeamId || null : teamId}
              onSelect={handleSelectTable}
              disabled={isPending || (isAdmin ? !adminTeamId : !canReserve)}
              adminMode={isAdmin && Boolean(adminTeamId)}
            />
          </CardContent>
        </Card>

        <div className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>
                  {isAdmin ? "Manage tables" : "Reserve your spot"}
                </CardTitle>
                {isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
              </div>
              {user ? (
                <CardDescription>
                  {user.name}
                  {!isAdmin && user.teamName ? (
                    <>
                      {" "}
                      · Team{" "}
                      <span className="font-medium text-foreground">
                        {user.teamName}
                      </span>
                    </>
                  ) : null}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-500">
                  Event
                </label>
                <EventPicker
                  events={events}
                  selectedEventId={selectedEventId}
                />
              </div>

              <Separator />

              {!user ? (
                <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
                  Signed-in user not found. Run{" "}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                    pnpm db:seed
                  </code>
                  .
                </div>
              ) : isAdmin ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-500">
                      Team to move
                    </label>
                    <Select
                      value={adminTeamId || undefined}
                      onValueChange={setAdminTeamId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {adminTeamId ? (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-200 p-3 text-xs text-zinc-500">
                      <ArrowRightLeft className="size-3.5 shrink-0" />
                      Click a table to move{" "}
                      {teams.find((t) => t.id === adminTeamId)?.name ?? "team"}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      Pick a team, then click a table on the map. Occupied
                      tables swap the two teams.
                    </p>
                  )}
                </div>
              ) : !teamId ? (
                <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
                  You&apos;re not on a team yet.
                </div>
              ) : hasReservation ? (
                <div className="rounded-lg border border-[#445721]/30 bg-[#445721]/10 p-3">
                  <p className="text-xs text-zinc-500">
                    Your team&apos;s table
                  </p>
                  <p
                    className="font-heading text-2xl italic"
                    style={{ color: "#3A4A26" }}
                  >
                    Table {myTable!.number}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Reservations are final and cannot be changed.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
                  {selectedTable
                    ? `Table ${selectedTable.number} selected — reserve it below.`
                    : "No table reserved yet."}
                </div>
              )}

              {canReserve && (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleReserve}
                    disabled={isPending || !selectedTable}
                  >
                    <Ticket />
                    {selectedTable
                      ? `Reserve table ${selectedTable.number}`
                      : "Select & reserve"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleRandom}
                    disabled={isPending}
                  >
                    <Shuffle /> Randomly assign
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={pendingAdminMove !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setPendingAdminMove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm table move</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {pendingAdminMove?.reservedByTeamName ? (
                  <>
                    <p>
                      Swap <strong>{adminTeamName}</strong>
                      {adminTeamCurrentTable
                        ? ` (table ${adminTeamCurrentTable.number})`
                        : ""}{" "}
                      with{" "}
                      <strong>{pendingAdminMove.reservedByTeamName}</strong>{" "}
                      (table {pendingAdminMove.number})?
                    </p>
                  </>
                ) : (
                  <p>
                    Move <strong>{adminTeamName}</strong>
                    {adminTeamCurrentTable
                      ? ` from table ${adminTeamCurrentTable.number}`
                      : ""}{" "}
                    to table <strong>{pendingAdminMove?.number}</strong>?
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingAdminMove(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmAdminMove} disabled={isPending}>
              {isPending ? "Moving…" : "Confirm move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
