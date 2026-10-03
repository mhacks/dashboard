"use client";

import {
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateReservationMapSize,
  updateReservationTableGeometry,
  type ReservationActionResult,
} from "@/lib/actions/admin-reservations.server.actions";
import {
  MAX_MAP_DIMENSION,
  MIN_MAP_DIMENSION,
  reservationGridExtent,
  type TableGeometry,
} from "@/lib/reservation/domain";
import type { TableWithTeam } from "@/lib/reservation/types";
import { cn } from "@/lib/utils";
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

const MAP_DIMENSION_MESSAGE = `Enter a whole number from ${MIN_MAP_DIMENSION} to ${MAX_MAP_DIMENSION}.`;

type DragMode = "move" | "resize";

type DragSession = {
  tableId: string;
  mode: DragMode;
  pointerId: number;
  moved: boolean;
  startCell: { col: number; row: number };
  start: TableGeometry;
};

function parseWholeNumber(value: string, minimum: number, maximum: number) {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function fieldError(
  result: Extract<ReservationActionResult, { ok: false }>,
  field: string,
) {
  const messages = result.fieldErrors?.[field];
  return messages?.length ? messages.join(" ") : null;
}

function sameGeometry(left: TableGeometry, right: TableGeometry) {
  return (
    left.originX === right.originX &&
    left.originY === right.originY &&
    left.width === right.width &&
    left.height === right.height
  );
}

function cellFromPointer(grid: HTMLElement, clientX: number, clientY: number) {
  const origin = grid.getBoundingClientRect();
  const sample = grid.querySelector<HTMLElement>("[data-map-cell]");
  const sampleRect = sample?.getBoundingClientRect();
  const styles = getComputedStyle(grid);
  const gapX = Number.parseFloat(styles.columnGap) || 0;
  const gapY = Number.parseFloat(styles.rowGap) || 0;
  const cellWidth = sampleRect?.width || 40;
  const cellHeight = sampleRect?.height || 40;
  return {
    col: Math.max(0, Math.floor((clientX - origin.left) / (cellWidth + gapX))),
    row: Math.max(0, Math.floor((clientY - origin.top) / (cellHeight + gapY))),
  };
}

function geometryFromDrag(
  session: DragSession,
  col: number,
  row: number,
): TableGeometry {
  if (session.mode === "resize") {
    return {
      originX: session.start.originX,
      originY: session.start.originY,
      width: Math.max(1, col - session.start.originX + 1),
      height: Math.max(1, row - session.start.originY + 1),
    };
  }

  return {
    originX: Math.max(0, session.start.originX + col - session.startCell.col),
    originY: Math.max(0, session.start.originY + row - session.startCell.row),
    width: session.start.width,
    height: session.start.height,
  };
}

export function TableLayoutEditor({
  columns,
  disabled,
  onMutationEnd,
  onMutationStart,
  onSelect,
  rows,
  selectedTableId,
  tables,
}: {
  columns: number;
  disabled: boolean;
  onMutationEnd: (mutationId: string) => void;
  onMutationStart: (mutationId: string) => boolean;
  onSelect: (tableId: string) => void;
  rows: number;
  selectedTableId: string | null;
  tables: TableWithTeam[];
}) {
  const router = useRouter();
  const columnsInputId = useId();
  const rowsInputId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const draftRef = useRef<(TableGeometry & { tableId: string }) | null>(null);
  const [draft, setDraft] = useState<
    (TableGeometry & { tableId: string }) | null
  >(null);
  const [sizeDraft, setSizeDraft] = useState<{
    columns: number;
    rows: number;
    columnValue: string;
    rowValue: string;
  } | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [columnError, setColumnError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [sizePending, setSizePending] = useState(false);
  const [, startTransition] = useTransition();

  const columnValue =
    sizeDraft?.columns === columns && sizeDraft.rows === rows
      ? sizeDraft.columnValue
      : String(columns);
  const rowValue =
    sizeDraft?.columns === columns && sizeDraft.rows === rows
      ? sizeDraft.rowValue
      : String(rows);

  const displayed = tables.map((table) =>
    draft?.tableId === table.id ? { ...table, ...draft } : table,
  );
  const extent = reservationGridExtent(displayed, columns, rows);
  const cellCount = extent.columns * extent.rows;
  const selected =
    displayed.find((table) => table.id === selectedTableId) ?? null;

  useEffect(() => {
    const current = draftRef.current;
    if (!current) return;
    const persisted = tables.find((table) => table.id === current.tableId);
    if (persisted && sameGeometry(persisted, current)) {
      draftRef.current = null;
      setDraft(null);
    }
  }, [tables]);

  function rememberDraft(next: TableGeometry & { tableId: string }) {
    draftRef.current = next;
    setDraft(next);
  }

  function clearDraft() {
    draftRef.current = null;
    setDraft(null);
  }

  function displayedGeometry(table: TableWithTeam): TableGeometry {
    if (draftRef.current?.tableId === table.id) return draftRef.current;
    return table;
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    table: TableWithTeam,
    mode: DragMode,
  ) {
    if (disabled || event.button !== 0) return;
    const grid = gridRef.current;
    if (!grid) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(table.id);
    const startCell = cellFromPointer(grid, event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = {
      tableId: table.id,
      mode,
      pointerId: event.pointerId,
      moved: false,
      startCell,
      start: displayedGeometry(table),
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    const grid = gridRef.current;
    if (!session || !grid || session.pointerId !== event.pointerId) return;
    const cell = cellFromPointer(grid, event.clientX, event.clientY);
    const next = {
      tableId: session.tableId,
      ...geometryFromDrag(session, cell.col, cell.row),
    };
    if (sameGeometry(next, session.start)) return;
    session.moved = true;
    rememberDraft(next);
  }

  function endDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    tableId: string,
  ) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    if (!session.moved || session.tableId !== tableId) return;

    const persisted = tables.find((table) => table.id === tableId);
    const next = draftRef.current;
    if (
      !persisted ||
      !next ||
      next.tableId !== tableId ||
      sameGeometry(next, persisted)
    ) {
      if (
        next?.tableId === tableId &&
        persisted &&
        sameGeometry(next, persisted)
      ) {
        clearDraft();
      }
      return;
    }
    if (!onMutationStart(`layout:${tableId}`)) {
      clearDraft();
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateReservationTableGeometry({
          tableId,
          originX: next.originX,
          originY: next.originY,
          width: next.width,
          height: next.height,
        });
        if (!result.ok) {
          clearDraft();
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch {
        clearDraft();
        toast.error("Could not save the table layout. Try again.");
      } finally {
        onMutationEnd(`layout:${tableId}`);
      }
    });
  }

  function handleSizeSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (disabled) return;

    const nextColumns = parseWholeNumber(
      columnValue,
      MIN_MAP_DIMENSION,
      MAX_MAP_DIMENSION,
    );
    const nextRows = parseWholeNumber(
      rowValue,
      MIN_MAP_DIMENSION,
      MAX_MAP_DIMENSION,
    );
    setSizeError(null);
    setColumnError(nextColumns === null ? MAP_DIMENSION_MESSAGE : null);
    setRowError(nextRows === null ? MAP_DIMENSION_MESSAGE : null);
    if (nextColumns === null || nextRows === null) return;
    if (nextColumns === columns && nextRows === rows) return;
    if (!onMutationStart("map-size")) return;
    setSizePending(true);

    startTransition(async () => {
      try {
        const result = await updateReservationMapSize({
          columns: nextColumns,
          rows: nextRows,
        });
        if (!result.ok) {
          setSizeError(result.error);
          setColumnError(fieldError(result, "columns"));
          setRowError(fieldError(result, "rows"));
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch {
        setSizeError("Could not save the map size. Try again.");
      } finally {
        setSizePending(false);
        onMutationEnd("map-size");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Floor plan</CardTitle>
        <CardDescription>
          Drag a table to set its reference cell. Drag the corner handle to
          change how many columns and rows it covers. Overlaps are allowed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          noValidate
          onSubmit={handleSizeSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={columnsInputId}>Columns</Label>
            <Input
              id={columnsInputId}
              type="number"
              inputMode="numeric"
              min={MIN_MAP_DIMENSION}
              max={MAX_MAP_DIMENSION}
              step={1}
              value={columnValue}
              disabled={disabled}
              aria-invalid={Boolean(columnError)}
              aria-describedby={
                columnError ? `${columnsInputId}-error` : undefined
              }
              onChange={(inputEvent) => {
                setSizeDraft({
                  columns,
                  rows,
                  columnValue: inputEvent.target.value,
                  rowValue,
                });
                setSizeError(null);
                setColumnError(null);
              }}
              className="w-28"
            />
            {columnError ? (
              <p
                id={`${columnsInputId}-error`}
                className="text-xs text-destructive"
              >
                {columnError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={rowsInputId}>Rows</Label>
            <Input
              id={rowsInputId}
              type="number"
              inputMode="numeric"
              min={MIN_MAP_DIMENSION}
              max={MAX_MAP_DIMENSION}
              step={1}
              value={rowValue}
              disabled={disabled}
              aria-invalid={Boolean(rowError)}
              aria-describedby={rowError ? `${rowsInputId}-error` : undefined}
              onChange={(inputEvent) => {
                setSizeDraft({
                  columns,
                  rows,
                  columnValue,
                  rowValue: inputEvent.target.value,
                });
                setSizeError(null);
                setRowError(null);
              }}
              className="w-28"
            />
            {rowError ? (
              <p
                id={`${rowsInputId}-error`}
                className="text-xs text-destructive"
              >
                {rowError}
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={disabled} variant="outline">
            {sizePending ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            ) : null}
            Save map size
          </Button>
        </form>
        {sizeError ? (
          <p role="alert" className="text-sm text-destructive">
            {sizeError}
          </p>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {selected
            ? `Table ${selected.number}: column ${selected.originX + 1}, row ${selected.originY + 1}, ${selected.width} × ${selected.height}.`
            : "Select a table on the map or in the list below."}
        </p>

        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5 sm:p-8">
          <div
            ref={gridRef}
            className="grid w-fit gap-2 [--cell:2.5rem]"
            style={{
              gridTemplateColumns: `repeat(${extent.columns}, var(--cell))`,
              gridTemplateRows: `repeat(${extent.rows}, var(--cell))`,
            }}
          >
            {Array.from({ length: cellCount }, (_, index) => (
              <span
                key={`cell-${index}`}
                data-map-cell=""
                aria-hidden
                className="pointer-events-none flex items-center justify-center"
                style={{
                  gridColumn: (index % extent.columns) + 1,
                  gridRow: Math.floor(index / extent.columns) + 1,
                }}
              >
                <span className="size-1.5 rounded-full bg-zinc-300/80" />
              </span>
            ))}
            {displayed.map((table) => {
              const selectedTable = table.id === selectedTableId;
              return (
                <div
                  key={table.id}
                  className={cn("relative z-10", selectedTable && "z-20")}
                  style={{
                    gridColumn: `${table.originX + 1} / span ${table.width}`,
                    gridRow: `${table.originY + 1} / span ${table.height}`,
                  }}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={selectedTable}
                    aria-label={`Table ${table.number}, column ${table.originX + 1}, row ${table.originY + 1}, ${table.width} by ${table.height}`}
                    title={
                      table.reservedByTeamName
                        ? `Table ${table.number} — ${table.reservedByTeamName}`
                        : `Table ${table.number}`
                    }
                    onPointerDown={(event) => beginDrag(event, table, "move")}
                    onPointerMove={moveDrag}
                    onPointerUp={(event) => endDrag(event, table.id)}
                    onPointerCancel={(event) => endDrag(event, table.id)}
                    className={cn(
                      "absolute inset-0 flex touch-none items-center justify-center rounded-md border text-xs font-semibold",
                      selectedTable
                        ? "border-[#445721] bg-[#445721] text-white shadow-sm"
                        : table.reservedByTeamId
                          ? "border-[#445721]/40 bg-[#445721]/10 text-[#3A4A26]"
                          : "border-zinc-300 bg-white text-zinc-700 hover:border-[#445721]",
                      disabled
                        ? "cursor-not-allowed"
                        : "cursor-grab active:cursor-grabbing",
                    )}
                  >
                    {table.number}
                  </button>
                  {selectedTable ? (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Resize table ${table.number}`}
                      onPointerDown={(event) =>
                        beginDrag(event, table, "resize")
                      }
                      onPointerMove={moveDrag}
                      onPointerUp={(event) => endDrag(event, table.id)}
                      onPointerCancel={(event) => endDrag(event, table.id)}
                      className="absolute right-1 bottom-1 z-30 size-3 touch-none cursor-nwse-resize rounded-sm border border-white bg-[#3A4A26] shadow disabled:cursor-not-allowed"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        The reference cell is the top-left corner of the rectangle.
      </CardFooter>
    </Card>
  );
}
