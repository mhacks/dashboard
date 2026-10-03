"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  setReservationTableCount,
  type ReservationActionResult,
} from "@/lib/actions/admin-reservations.server.actions";
import {
  formatReservationList,
  MAX_RESERVATION_TABLE_COUNT,
  planTableCountChange,
} from "@/lib/reservation/domain";
import type { TableWithTeam } from "@/lib/reservation/types";
import type { ReservationTableTopology } from "@/lib/reservation/validation";
import { TableLayoutEditor } from "./table-layout-editor";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

const ASSIGNMENTS_HREF = "/admin/teams/reservations/assignments";

export type TableManagementProps = {
  columns: number;
  rows: number;
  tables: TableWithTeam[];
};

function parseWholeNumber(value: string, minimum: number, maximum: number) {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

const TABLE_COUNT_RANGE_MESSAGE = `Enter a whole number from 0 to ${MAX_RESERVATION_TABLE_COUNT}.`;

function exceedsMaximum(value: string, maximum: number): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > maximum;
}

function topologyOf(
  tables: readonly TableWithTeam[],
): ReservationTableTopology {
  return tables.map(({ id, number, reservedByTeamId }) => ({
    id,
    number,
    reservedByTeamId,
  }));
}

function fieldError(
  result: Extract<ReservationActionResult, { ok: false }>,
  field: string,
) {
  const messages = result.fieldErrors?.[field];
  return messages?.length ? messages.join(" ") : null;
}

function PendingIcon({ pending }: { pending: boolean }) {
  return pending ? (
    <Loader2Icon data-icon="inline-start" className="animate-spin" />
  ) : null;
}

function TableCountManagement({
  onMutationEnd,
  onMutationStart,
  tables,
  workspacePending,
}: {
  onMutationEnd: (mutationId: string) => void;
  onMutationStart: (mutationId: string) => boolean;
  tables: TableWithTeam[];
  workspacePending: boolean;
}) {
  const router = useRouter();
  const countInputId = useId();
  const countInputRef = useRef<HTMLInputElement>(null);
  const [countDraft, setCountDraft] = useState<{
    tableCount: number;
    value: string;
  } | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [countFieldError, setCountFieldError] = useState<string | null>(null);
  const [reductionOpen, setReductionOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const desiredCount =
    countDraft?.tableCount === tables.length
      ? countDraft.value
      : String(tables.length);
  const parsedDesiredCount = parseWholeNumber(
    desiredCount,
    0,
    MAX_RESERVATION_TABLE_COUNT,
  );
  const isReduction =
    parsedDesiredCount !== null && parsedDesiredCount < tables.length;
  const tablesById = useMemo(
    () => new Map(tables.map((table) => [table.id, table])),
    [tables],
  );
  const countPlan = useMemo(() => {
    if (parsedDesiredCount === null || parsedDesiredCount >= tables.length) {
      return null;
    }
    return planTableCountChange(tables, parsedDesiredCount);
  }, [parsedDesiredCount, tables]);
  const reductionTargets = useMemo(
    () =>
      (countPlan?.removeIds ?? [])
        .map((id) => tablesById.get(id))
        .filter((table): table is TableWithTeam => table !== undefined),
    [countPlan, tablesById],
  );
  const reductionBlockers = useMemo(
    () =>
      reductionTargets
        .filter((table) => table.reservedByTeamId)
        .sort((left, right) => left.number - right.number),
    [reductionTargets],
  );

  function handleDesiredCountChange(value: string) {
    setCountDraft({ tableCount: tables.length, value });
    setCountError(null);
    setCountFieldError(null);
    setReductionOpen(false);
  }

  function runCountAction(count: number) {
    if (!onMutationStart("count")) return;

    startTransition(async () => {
      try {
        const result = await setReservationTableCount({
          count,
          expectedTables: topologyOf(tables),
        });
        if (!result.ok) {
          setCountError(result.error);
          setCountFieldError(fieldError(result, "count"));
          return;
        }

        setCountDraft({ tableCount: tables.length, value: String(count) });
        setReductionOpen(false);
        toast.success(result.message);
        router.refresh();
      } catch {
        setCountError("Could not change the table count. Try again.");
        setCountFieldError(null);
      } finally {
        onMutationEnd("count");
      }
    });
  }

  function handleCountSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (workspacePending) return;

    const count = parseWholeNumber(
      desiredCount,
      0,
      MAX_RESERVATION_TABLE_COUNT,
    );
    setCountError(null);
    setCountFieldError(null);
    if (count === null) {
      setCountFieldError(
        exceedsMaximum(desiredCount, MAX_RESERVATION_TABLE_COUNT)
          ? TABLE_COUNT_RANGE_MESSAGE
          : "Enter a non-negative whole number.",
      );
      return;
    }
    if (count === tables.length) return;
    if (count < tables.length) {
      setReductionOpen(true);
      return;
    }

    runCountAction(count);
  }

  function handleReductionOpenChange(open: boolean) {
    if (!open && isPending) return;
    setReductionOpen(open);
  }

  const targetNumbers = reductionTargets.map((table) => table.number);
  const blockerLabels = reductionBlockers.map(
    (table) =>
      `${table.number} (${table.reservedByTeamName ?? "Assigned team"})`,
  );
  const targetLabel =
    reductionTargets.length > 5
      ? `${reductionTargets.length} highest-numbered tables will be removed.`
      : `${reductionTargets.length === 1 ? "Table" : "Tables"} ${formatReservationList(
          targetNumbers,
        )} will be removed.`;
  const blockerLabel =
    reductionBlockers.length > 5
      ? `${reductionBlockers.length} assigned tables block this reduction.`
      : `Assigned ${
          reductionBlockers.length === 1 ? "table" : "tables"
        } ${formatReservationList(blockerLabels)} ${
          reductionBlockers.length === 1 ? "blocks" : "block"
        } this reduction.`;

  return (
    <>
      <form noValidate onSubmit={handleCountSubmit}>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Set table count</CardTitle>
            <CardDescription>
              Add sequential tables or remove the highest-numbered open tables.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={countInputId}>Desired table count</Label>
              <Input
                ref={countInputRef}
                id={countInputId}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_RESERVATION_TABLE_COUNT}
                step={1}
                value={desiredCount}
                disabled={workspacePending}
                aria-invalid={Boolean(countFieldError)}
                aria-describedby={
                  countFieldError ? `${countInputId}-error` : undefined
                }
                onChange={(inputEvent) =>
                  handleDesiredCountChange(inputEvent.target.value)
                }
              />
              {countFieldError ? (
                <p
                  id={`${countInputId}-error`}
                  className="text-xs text-destructive"
                >
                  {countFieldError}
                </p>
              ) : null}
            </div>
            {countError ? (
              <p role="alert" className="text-sm text-destructive">
                {countError}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="submit"
              disabled={
                workspacePending || parsedDesiredCount === tables.length
              }
            >
              <PendingIcon pending={isPending} />
              {isReduction ? "Review reduction" : "Set table count"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <AlertDialog
        open={reductionOpen}
        onOpenChange={handleReductionOpenChange}
      >
        <AlertDialogContent
          onCloseAutoFocus={(focusEvent) => {
            const target = countInputRef.current;
            if (target?.isConnected && !target.disabled) {
              target.focus();
              if (document.activeElement === target) {
                focusEvent.preventDefault();
              }
            }
          }}
          onEscapeKeyDown={(keyboardEvent) => {
            if (isPending) keyboardEvent.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Reduce the table count?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-3">
                <p>{targetLabel}</p>
                <ScrollArea
                  role="region"
                  aria-label="Reduction targets and blockers"
                  className="h-48 rounded-md border p-3"
                >
                  <div className="flex flex-col gap-4 pr-3">
                    <div className="flex flex-col gap-2">
                      <p className="font-medium text-foreground">
                        Tables to remove
                      </p>
                      <ul className="flex flex-col gap-1">
                        {reductionTargets.map((table) => (
                          <li key={table.id}>
                            Table {table.number}
                            {table.reservedByTeamId
                              ? ` — ${
                                  table.reservedByTeamName ?? "Assigned team"
                                }`
                              : " — Open"}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {reductionBlockers.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <p className="font-medium text-destructive">
                          Assignment blockers
                        </p>
                        <ul className="flex flex-col gap-1 text-destructive">
                          {reductionBlockers.map((table) => (
                            <li key={table.id}>
                              Table {table.number} —{" "}
                              {table.reservedByTeamName ?? "Assigned team"}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
                {reductionBlockers.length > 0 ? (
                  <p className="text-destructive">{blockerLabel}</p>
                ) : (
                  <p>Only open tables are targeted.</p>
                )}
                <p>This action cannot be undone.</p>
              </div>
            </AlertDialogDescription>
            {countError ? (
              <p role="alert" className="text-sm text-destructive">
                {countError}
              </p>
            ) : null}
            {countFieldError ? (
              <p className="text-sm text-destructive">{countFieldError}</p>
            ) : null}
          </AlertDialogHeader>
          {reductionBlockers.length > 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={ASSIGNMENTS_HREF}>Manage assignments</Link>
            </Button>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending || reductionBlockers.length > 0}
              onClick={(clickEvent) => {
                clickEvent.preventDefault();
                if (parsedDesiredCount !== null) {
                  runCountAction(parsedDesiredCount);
                }
              }}
            >
              <PendingIcon pending={isPending} />
              Confirm reduction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TableManagementWorkspace({
  columns,
  rows,
  tables,
}: TableManagementProps) {
  const mutationLockRef = useRef<string | null>(null);
  const assignedCount = tables.filter((table) => table.reservedByTeamId).length;
  const openCount = tables.length - assignedCount;
  const [activeMutation, setActiveMutation] = useState<string | null>(null);
  const workspacePending = activeMutation !== null;

  function startMutation(mutationId: string) {
    if (mutationLockRef.current) return false;
    mutationLockRef.current = mutationId;
    setActiveMutation(mutationId);
    return true;
  }

  function endMutation(mutationId: string) {
    if (mutationLockRef.current !== mutationId) return;
    mutationLockRef.current = null;
    setActiveMutation(null);
  }

  return (
    <section className="flex flex-col gap-6">
      <TableLayoutEditor
        columns={columns}
        disabled={workspacePending}
        onMutationEnd={endMutation}
        onMutationStart={startMutation}
        rows={rows}
        tables={tables}
      />

      <section aria-label="Table summary" className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{tables.length} total</CardTitle>
            <CardDescription>Total tables</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>{assignedCount} assigned</CardTitle>
            <CardDescription>Reserved by teams</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>{openCount} open</CardTitle>
            <CardDescription>Available to assign</CardDescription>
          </CardHeader>
        </Card>
      </section>

      <TableCountManagement
        onMutationEnd={endMutation}
        onMutationStart={startMutation}
        tables={tables}
        workspacePending={workspacePending}
      />
    </section>
  );
}

export function TableManagement(props: TableManagementProps) {
  return <TableManagementWorkspace key={props.tables.length} {...props} />;
}
