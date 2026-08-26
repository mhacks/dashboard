"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  createReservationTable,
  deleteReservationTable,
  renumberReservationTable,
  setReservationTableCount,
  type ReservationActionResult,
} from "@/lib/actions/admin-reservations.server.actions";
import type { AdminReservationEventDetail } from "@/lib/queries/admin-reservations";
import {
  MAX_RESERVATION_TABLE_COUNT,
  MAX_RESERVATION_TABLE_NUMBER,
} from "@/lib/reservation/domain";
import type { TableWithTeam } from "@/lib/reservation/types";
import type { ReservationTableTopology } from "@/lib/reservation/validation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

export type TableManagementProps = {
  event: AdminReservationEventDetail;
  tables: TableWithTeam[];
};

type CountFocusIntent =
  | { kind: "next-source"; fromCount: number }
  | { kind: "target-source"; count: number };

type CountFocusIntentRef = {
  current: CountFocusIntent | null;
};

function parseWholeNumber(value: string, minimum: number, maximum: number) {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

const TABLE_COUNT_RANGE_MESSAGE = `Enter a whole number from 0 to ${MAX_RESERVATION_TABLE_COUNT}.`;
const TABLE_NUMBER_RANGE_MESSAGE = `Enter a whole number from 1 to ${MAX_RESERVATION_TABLE_NUMBER.toLocaleString("en-US")}.`;

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

function formatList(values: readonly (number | string)[]) {
  const labels = values.map(String);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
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

function TableCard({
  eventId,
  onMutationEnd,
  onMutationStart,
  readOnly,
  table,
  workspacePending,
}: {
  eventId: string;
  onMutationEnd: (mutationId: string) => void;
  onMutationStart: (mutationId: string) => boolean;
  readOnly: boolean;
  table: TableWithTeam;
  workspacePending: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const renumberInputRef = useRef<HTMLInputElement>(null);
  const renumberOriginRef = useRef<HTMLElement | null>(null);
  const [numberValue, setNumberValue] = useState(String(table.number));
  const [actionError, setActionError] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renumberOpen, setRenumberOpen] = useState(false);
  const [renumberTarget, setRenumberTarget] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const assigned = Boolean(table.reservedByTeamId);
  const controlsDisabled = readOnly || workspacePending;

  function handleNumberChange(value: string) {
    setNumberValue(value);
    setActionError(null);
    setNumberError(null);
  }

  function handleRenumber(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (readOnly || workspacePending) return;

    const number = parseWholeNumber(
      numberValue,
      1,
      MAX_RESERVATION_TABLE_NUMBER,
    );
    setActionError(null);
    setNumberError(null);
    if (number === null) {
      setNumberError(
        exceedsMaximum(numberValue, MAX_RESERVATION_TABLE_NUMBER)
          ? TABLE_NUMBER_RANGE_MESSAGE
          : "Enter a positive whole number.",
      );
      return;
    }

    const submitter = (submitEvent.nativeEvent as SubmitEvent).submitter;
    const activeElement = document.activeElement;
    renumberOriginRef.current =
      submitter instanceof HTMLElement
        ? submitter
        : activeElement instanceof HTMLElement &&
            submitEvent.currentTarget.contains(activeElement)
          ? activeElement
          : renumberInputRef.current;
    setRenumberTarget(number);
    setRenumberOpen(true);
  }

  function confirmRenumber() {
    if (
      readOnly ||
      workspacePending ||
      renumberTarget === null ||
      !onMutationStart(`renumber:${table.id}`)
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await renumberReservationTable({
          eventId,
          tableId: table.id,
          number: renumberTarget,
        });
        if (!result.ok) {
          setActionError(result.error);
          setNumberError(fieldError(result, "number"));
          return;
        }

        setRenumberOpen(false);
        toast.success(result.message);
        router.refresh();
      } catch {
        setActionError("Could not renumber the table. Try again.");
      } finally {
        onMutationEnd(`renumber:${table.id}`);
      }
    });
  }

  function handleDelete() {
    if (
      readOnly ||
      assigned ||
      workspacePending ||
      !onMutationStart(`delete:${table.id}`)
    ) {
      return;
    }

    setActionError(null);
    startTransition(async () => {
      try {
        const result = await deleteReservationTable({
          eventId,
          tableId: table.id,
        });
        if (!result.ok) {
          setActionError(result.error);
          return;
        }

        setDeleteOpen(false);
        toast.success(result.message);
        router.refresh();
      } catch {
        setActionError("Could not delete the table. Try again.");
      } finally {
        onMutationEnd(`delete:${table.id}`);
      }
    });
  }

  function handleDeleteOpenChange(open: boolean) {
    if (!open && isPending) return;
    if (open) setActionError(null);
    setDeleteOpen(open);
  }

  function handleRenumberOpenChange(open: boolean) {
    if (!open && isPending) return;
    setRenumberOpen(open);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Table {table.number}</CardTitle>
        <CardDescription>
          {assigned ? "Assigned table" : "Open table"}
        </CardDescription>
        <CardAction>
          <Badge variant={assigned ? "secondary" : "outline"}>
            {assigned ? "Assigned" : "Open"}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground">
          {assigned
            ? (table.reservedByTeamName ?? "Assigned team")
            : "Open for assignment"}
        </p>
        {actionError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {actionError}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-end">
        <form
          className="flex flex-1 items-end gap-2"
          noValidate
          onSubmit={handleRenumber}
        >
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={inputId}>New number for table {table.number}</Label>
            <Input
              ref={renumberInputRef}
              id={inputId}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_RESERVATION_TABLE_NUMBER}
              step={1}
              value={numberValue}
              disabled={controlsDisabled}
              aria-invalid={Boolean(numberError)}
              aria-describedby={numberError ? `${inputId}-error` : undefined}
              onChange={(inputEvent) =>
                handleNumberChange(inputEvent.target.value)
              }
            />
            {numberError ? (
              <p id={`${inputId}-error`} className="text-xs text-destructive">
                {numberError}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={controlsDisabled}
            aria-label={`Renumber table ${table.number}`}
          >
            <PendingIcon pending={isPending} />
            Renumber
          </Button>
        </form>

        <AlertDialog
          open={renumberOpen}
          onOpenChange={handleRenumberOpenChange}
        >
          <AlertDialogContent
            onCloseAutoFocus={(focusEvent) => {
              const target = renumberOriginRef.current;
              if (target?.isConnected && !target.matches(":disabled")) {
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
              <AlertDialogTitle>
                Renumber table {table.number} to {renumberTarget}?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="flex flex-col gap-2">
                  <p>
                    Table {table.number} will become table {renumberTarget}.
                  </p>
                  {assigned ? (
                    <p>
                      {table.reservedByTeamName ?? "The assigned team"} is
                      assigned to table {table.number} and will remain assigned
                      after it becomes table {renumberTarget}.
                    </p>
                  ) : (
                    <p>This open table will keep its assignment status.</p>
                  )}
                </div>
              </AlertDialogDescription>
              {actionError ? (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              ) : null}
              {numberError ? (
                <p className="text-sm text-destructive">{numberError}</p>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={(clickEvent) => {
                  clickEvent.preventDefault();
                  confirmRenumber();
                }}
              >
                <PendingIcon pending={isPending} />
                Confirm renumber
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {assigned ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/reservations/${eventId}/assignments`}>
              Manage assignments
            </Link>
          </Button>
        ) : readOnly ? null : (
          <AlertDialog open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={workspacePending}
                aria-label={`Delete table ${table.number}`}
              >
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent
              onEscapeKeyDown={(keyboardEvent) => {
                if (isPending) keyboardEvent.preventDefault();
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete table {table.number}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the open table. This action cannot be
                  undone.
                </AlertDialogDescription>
                {actionError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {actionError}
                  </p>
                ) : null}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isPending}
                  onClick={(clickEvent) => {
                    clickEvent.preventDefault();
                    handleDelete();
                  }}
                >
                  <PendingIcon pending={isPending} />
                  Delete table
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}

function TableCountManagement({
  eventId,
  focusIntentRef,
  onMutationEnd,
  onMutationStart,
  readOnly,
  tables,
  workspacePending,
}: {
  eventId: string;
  focusIntentRef: CountFocusIntentRef;
  onMutationEnd: (mutationId: string) => void;
  onMutationStart: (mutationId: string) => boolean;
  readOnly: boolean;
  tables: TableWithTeam[];
  workspacePending: boolean;
}) {
  const router = useRouter();
  const countInputId = useId();
  const countInputRef = useRef<HTMLInputElement>(null);
  const reductionOpenRef = useRef(false);
  const [desiredCount, setDesiredCount] = useState(String(tables.length));
  const [countError, setCountError] = useState<string | null>(null);
  const [countFieldError, setCountFieldError] = useState<string | null>(null);
  const [reductionOpen, setReductionOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const parsedDesiredCount = parseWholeNumber(
    desiredCount,
    0,
    MAX_RESERVATION_TABLE_COUNT,
  );
  const isReduction =
    parsedDesiredCount !== null && parsedDesiredCount < tables.length;
  const reductionTargets = useMemo(() => {
    if (parsedDesiredCount === null || parsedDesiredCount >= tables.length) {
      return [];
    }

    return [...tables]
      .sort((left, right) => right.number - left.number)
      .slice(0, tables.length - parsedDesiredCount);
  }, [parsedDesiredCount, tables]);
  const reductionBlockers = useMemo(
    () =>
      reductionTargets
        .filter((table) => table.reservedByTeamId)
        .sort((left, right) => left.number - right.number),
    [reductionTargets],
  );

  useLayoutEffect(() => {
    const mountedInput = countInputRef.current;

    return () => {
      if (
        reductionOpenRef.current ||
        (mountedInput?.isConnected && document.activeElement === mountedInput)
      ) {
        if (focusIntentRef.current?.kind !== "target-source") {
          focusIntentRef.current = {
            kind: "next-source",
            fromCount: tables.length,
          };
        }
      }
    };
  }, [focusIntentRef, tables.length]);

  useLayoutEffect(() => {
    const intent = focusIntentRef.current;
    const matchesSource =
      intent?.kind === "target-source"
        ? intent.count === tables.length
        : intent?.kind === "next-source" && intent.fromCount !== tables.length;
    const target = countInputRef.current;
    if (
      !matchesSource ||
      workspacePending ||
      !target?.isConnected ||
      target.disabled
    ) {
      return;
    }

    target.focus();
    if (document.activeElement === target) {
      focusIntentRef.current = null;
    }
  }, [focusIntentRef, tables.length, workspacePending]);

  function setReductionDialogOpen(open: boolean) {
    reductionOpenRef.current = open;
    setReductionOpen(open);
  }

  function handleDesiredCountChange(value: string) {
    setDesiredCount(value);
    setCountError(null);
    setCountFieldError(null);
    setReductionDialogOpen(false);
  }

  function runCountAction(count: number) {
    if (!onMutationStart("count")) return;

    startTransition(async () => {
      try {
        const result = await setReservationTableCount({
          eventId,
          count,
          expectedTables: topologyOf(tables),
        });
        if (!result.ok) {
          setCountError(result.error);
          setCountFieldError(fieldError(result, "count"));
          return;
        }

        if (focusIntentRef.current?.kind !== "next-source") {
          focusIntentRef.current = { kind: "target-source", count };
        }
        setReductionDialogOpen(false);
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
    if (readOnly || workspacePending) return;

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
      setReductionDialogOpen(true);
      return;
    }

    runCountAction(count);
  }

  function handleReductionOpenChange(open: boolean) {
    if (!open && isPending) return;
    setReductionDialogOpen(open);
  }

  const targetNumbers = reductionTargets.map((table) => table.number);
  const blockerLabels = reductionBlockers.map(
    (table) =>
      `${table.number} (${table.reservedByTeamName ?? "Assigned team"})`,
  );
  const targetLabel =
    reductionTargets.length > 5
      ? `${reductionTargets.length} highest-numbered tables will be removed.`
      : `${reductionTargets.length === 1 ? "Table" : "Tables"} ${formatList(
          targetNumbers,
        )} will be removed.`;
  const blockerLabel =
    reductionBlockers.length > 5
      ? `${reductionBlockers.length} assigned tables block this reduction.`
      : `Assigned ${
          reductionBlockers.length === 1 ? "table" : "tables"
        } ${formatList(blockerLabels)} ${
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
                disabled={readOnly || workspacePending}
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
                readOnly ||
                workspacePending ||
                parsedDesiredCount === tables.length
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
              <Link href={`/admin/reservations/${eventId}/assignments`}>
                Manage assignments
              </Link>
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

function TableManagementWorkspace({ event, tables }: TableManagementProps) {
  const router = useRouter();
  const addInputId = useId();
  const countFocusIntentRef = useRef<CountFocusIntent | null>(null);
  const mutationLockRef = useRef<string | null>(null);
  const readOnly = event.status === "archived";
  const assignedCount = tables.filter((table) => table.reservedByTeamId).length;
  const openCount = tables.length - assignedCount;
  const [newTableNumber, setNewTableNumber] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addFieldError, setAddFieldError] = useState<string | null>(null);
  const [activeMutation, setActiveMutation] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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

  function handleAddSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (readOnly || workspacePending) return;

    const number = parseWholeNumber(
      newTableNumber,
      1,
      MAX_RESERVATION_TABLE_NUMBER,
    );
    setAddError(null);
    setAddFieldError(null);
    if (number === null) {
      setAddFieldError(
        exceedsMaximum(newTableNumber, MAX_RESERVATION_TABLE_NUMBER)
          ? TABLE_NUMBER_RANGE_MESSAGE
          : "Enter a positive whole number.",
      );
      return;
    }

    if (!startMutation("add")) return;

    startTransition(async () => {
      try {
        const result = await createReservationTable({
          eventId: event.id,
          number,
        });
        if (!result.ok) {
          setAddError(result.error);
          setAddFieldError(fieldError(result, "number"));
          return;
        }

        setNewTableNumber("");
        toast.success(result.message);
        router.refresh();
      } catch {
        setAddError("Could not create the table. Try again.");
      } finally {
        endMutation("add");
      }
    });
  }

  return (
    <section className="flex flex-col gap-6">
      {readOnly ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Read-only tables</CardTitle>
            <CardDescription>
              Archived events are read-only. Restore the event before editing
              tables.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

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

      <div className="grid gap-4 lg:grid-cols-2">
        <TableCountManagement
          key={tables.length}
          eventId={event.id}
          focusIntentRef={countFocusIntentRef}
          onMutationEnd={endMutation}
          onMutationStart={startMutation}
          readOnly={readOnly}
          tables={tables}
          workspacePending={workspacePending}
        />

        <form noValidate onSubmit={handleAddSubmit}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Add an individual table</CardTitle>
              <CardDescription>
                Add a specific positive table number without changing others.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor={addInputId}>New table number</Label>
                <Input
                  id={addInputId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_RESERVATION_TABLE_NUMBER}
                  step={1}
                  value={newTableNumber}
                  disabled={readOnly || workspacePending}
                  aria-invalid={Boolean(addFieldError)}
                  aria-describedby={
                    addFieldError ? `${addInputId}-error` : undefined
                  }
                  onChange={(inputEvent) => {
                    setNewTableNumber(inputEvent.target.value);
                    setAddError(null);
                    setAddFieldError(null);
                  }}
                />
                {addFieldError ? (
                  <p
                    id={`${addInputId}-error`}
                    className="text-xs text-destructive"
                  >
                    {addFieldError}
                  </p>
                ) : null}
              </div>
              {addError ? (
                <p role="alert" className="text-sm text-destructive">
                  {addError}
                </p>
              ) : null}
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={readOnly || workspacePending}>
                <PendingIcon pending={isPending} />
                Add table
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="tables-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="tables-heading" className="text-lg font-semibold">
              Individual tables
            </h2>
            <p className="text-sm text-muted-foreground">
              Renumber tables or manage unassigned table deletion.
            </p>
          </div>
          <Badge variant="outline">
            {tables.length} {tables.length === 1 ? "table" : "tables"}
          </Badge>
        </div>

        {tables.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No tables yet</CardTitle>
              <CardDescription>
                Set a desired count or add an individual table to begin.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {tables.map((table) => (
              <TableCard
                key={table.id}
                eventId={event.id}
                onMutationEnd={endMutation}
                onMutationStart={startMutation}
                readOnly={readOnly}
                table={table}
                workspacePending={workspacePending}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export function TableManagement(props: TableManagementProps) {
  return (
    <TableManagementWorkspace
      key={`${props.event.id}:${props.event.status}`}
      {...props}
    />
  );
}
