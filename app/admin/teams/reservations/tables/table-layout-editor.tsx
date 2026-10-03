"use client";

import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createReservationTable,
  deleteReservationTable,
  renumberReservationTable,
  updateReservationMapSize,
  updateReservationTableGeometries,
  type ReservationActionResult,
} from "@/lib/actions/admin-reservations.server.actions";
import {
  MAX_MAP_DIMENSION,
  MAX_RESERVATION_TABLE_NUMBER,
  MIN_MAP_DIMENSION,
  fitsReservationMap,
  reservationGridExtent,
  type TableGeometry,
} from "@/lib/reservation/domain";
import type { TableWithTeam } from "@/lib/reservation/types";
import { MapViewport } from "@/components/map-viewport";
import { cn } from "@/lib/utils";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAP_DIMENSION_MESSAGE = `Enter a whole number from ${MIN_MAP_DIMENSION} to ${MAX_MAP_DIMENSION}.`;
const TABLE_NUMBER_MESSAGE = `Enter a whole number from 1 to ${MAX_RESERVATION_TABLE_NUMBER.toLocaleString("en-US")}.`;
const ASSIGNMENTS_HREF = "/admin/teams/reservations/assignments";

type FloorPlanMenu =
  | { kind: "table"; tableId: string; x: number; y: number }
  | { kind: "add"; originX: number; originY: number; x: number; y: number };

type DragMode = "move" | "resize";

type GeometryDraft = TableGeometry & { tableId: string };

type DragSession = {
  anchorId: string;
  mode: DragMode;
  pointerId: number;
  moved: boolean;
  startCell: { col: number; row: number };
  lastCell: { col: number; row: number };
  anchorStart: TableGeometry;
  group: { tableId: string; start: TableGeometry }[];
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

function groupGeometry(
  session: DragSession,
  col: number,
  row: number,
): GeometryDraft[] {
  if (session.mode === "resize") {
    const rawWidth = col - session.anchorStart.originX + 1;
    const rawHeight = row - session.anchorStart.originY + 1;
    let widthDelta = rawWidth - session.anchorStart.width;
    let heightDelta = rawHeight - session.anchorStart.height;
    const minWidth = Math.min(...session.group.map((item) => item.start.width));
    const minHeight = Math.min(
      ...session.group.map((item) => item.start.height),
    );
    if (minWidth + widthDelta < 1) widthDelta = 1 - minWidth;
    if (minHeight + heightDelta < 1) heightDelta = 1 - minHeight;
    const widthRoom = Math.min(
      ...session.group.map(
        (item) => MAX_MAP_DIMENSION - item.start.originX - item.start.width,
      ),
    );
    const heightRoom = Math.min(
      ...session.group.map(
        (item) => MAX_MAP_DIMENSION - item.start.originY - item.start.height,
      ),
    );
    if (widthDelta > widthRoom) widthDelta = widthRoom;
    if (heightDelta > heightRoom) heightDelta = heightRoom;
    return session.group.map((item) => ({
      tableId: item.tableId,
      originX: item.start.originX,
      originY: item.start.originY,
      width: item.start.width + widthDelta,
      height: item.start.height + heightDelta,
    }));
  }

  let originDeltaX = col - session.startCell.col;
  let originDeltaY = row - session.startCell.row;
  const minOriginX = Math.min(
    ...session.group.map((item) => item.start.originX),
  );
  const minOriginY = Math.min(
    ...session.group.map((item) => item.start.originY),
  );
  if (minOriginX + originDeltaX < 0) originDeltaX = -minOriginX;
  if (minOriginY + originDeltaY < 0) originDeltaY = -minOriginY;
  const shiftRoomX = Math.min(
    ...session.group.map(
      (item) => MAX_MAP_DIMENSION - item.start.width - item.start.originX,
    ),
  );
  const shiftRoomY = Math.min(
    ...session.group.map(
      (item) => MAX_MAP_DIMENSION - item.start.height - item.start.originY,
    ),
  );
  if (originDeltaX > shiftRoomX) originDeltaX = shiftRoomX;
  if (originDeltaY > shiftRoomY) originDeltaY = shiftRoomY;
  return session.group.map((item) => ({
    tableId: item.tableId,
    originX: item.start.originX + originDeltaX,
    originY: item.start.originY + originDeltaY,
    width: item.start.width,
    height: item.start.height,
  }));
}

export function TableLayoutEditor({
  columns,
  controls,
  disabled,
  onMutationEnd,
  onMutationStart,
  rows,
  tables,
}: {
  columns: number;
  controls?: ReactNode;
  disabled: boolean;
  onMutationEnd: (mutationId: string) => void;
  onMutationStart: (mutationId: string) => boolean;
  rows: number;
  tables: TableWithTeam[];
}) {
  const router = useRouter();
  const columnsInputId = useId();
  const rowsInputId = useId();
  const planRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const draftRef = useRef<GeometryDraft[] | null>(null);
  const [drafts, setDrafts] = useState<GeometryDraft[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
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
  const [menu, setMenu] = useState<FloorPlanMenu | null>(null);
  const [numberDraft, setNumberDraft] = useState("");
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuPending, setMenuPending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const columnValue =
    sizeDraft?.columns === columns && sizeDraft.rows === rows
      ? sizeDraft.columnValue
      : String(columns);
  const rowValue =
    sizeDraft?.columns === columns && sizeDraft.rows === rows
      ? sizeDraft.rowValue
      : String(rows);

  const activeDrafts = drafts?.filter((draft) => {
    const persisted = tables.find((table) => table.id === draft.tableId);
    return persisted !== undefined && !sameGeometry(persisted, draft);
  });
  const draftById = new Map(
    activeDrafts?.map((draft) => [draft.tableId, draft]),
  );
  const displayed = tables.map((table) => {
    const draft = draftById.get(table.id);
    return draft ? { ...table, ...draft } : table;
  });
  const extent = reservationGridExtent(displayed, columns, rows);
  const cellCount = extent.columns * extent.rows;

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  function menuPosition(clientX: number, clientY: number) {
    const bounds = planRef.current?.getBoundingClientRect();
    if (!bounds) return { x: clientX, y: clientY };
    const width = 272;
    const height = 220;
    return {
      x: Math.min(Math.max(bounds.left + 8, clientX), bounds.right - width - 8),
      y: Math.min(
        Math.max(bounds.top + 8, clientY),
        bounds.bottom - height - 8,
      ),
    };
  }

  function openMenu(next: FloorPlanMenu, initialNumber: string) {
    setMenu(next);
    setNumberDraft(initialNumber);
    setMenuError(null);
  }

  function openTableMenu(event: ReactMouseEvent, table: TableWithTeam) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    openMenu(
      {
        kind: "table",
        tableId: table.id,
        ...menuPosition(event.clientX, event.clientY),
      },
      String(table.number),
    );
  }

  function openAddMenu(event: ReactMouseEvent) {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-floor-table]")) {
      return;
    }
    event.preventDefault();
    if (disabled) return;
    const grid = gridRef.current;
    if (!grid) return;
    const bounds = grid.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientY < bounds.top ||
      event.clientX > bounds.right ||
      event.clientY > bounds.bottom
    ) {
      return;
    }
    const cell = cellFromPointer(grid, event.clientX, event.clientY);
    const originX = Math.min(cell.col, Math.max(extent.columns - 1, 0));
    const originY = Math.min(cell.row, Math.max(extent.rows - 1, 0));
    const highest = tables.reduce(
      (maximum, table) => Math.max(maximum, table.number),
      0,
    );
    const nextNumber = highest + 1;
    openMenu(
      {
        kind: "add",
        originX,
        originY,
        ...menuPosition(event.clientX, event.clientY),
      },
      nextNumber <= MAX_RESERVATION_TABLE_NUMBER ? String(nextNumber) : "",
    );
  }

  function runMenuAction(mutationId: string, action: () => Promise<void>) {
    if (!onMutationStart(mutationId)) return;
    setMenuPending(true);
    startTransition(async () => {
      try {
        await action();
      } finally {
        setMenuPending(false);
        onMutationEnd(mutationId);
      }
    });
  }

  function submitMenuNumber(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!menu || disabled || menuPending) return;
    const number = parseWholeNumber(
      numberDraft,
      1,
      MAX_RESERVATION_TABLE_NUMBER,
    );
    setMenuError(null);
    if (number === null) {
      setMenuError(TABLE_NUMBER_MESSAGE);
      return;
    }
    if (menu.kind === "table") {
      const tableId = menu.tableId;
      runMenuAction(`renumber:${tableId}`, async () => {
        try {
          const result = await renumberReservationTable({ tableId, number });
          if (!result.ok) {
            setMenuError(result.error);
            return;
          }
          toast.success(result.message);
          setMenu(null);
          router.refresh();
        } catch {
          setMenuError("Could not renumber the table. Try again.");
        }
      });
      return;
    }
    const { originX, originY } = menu;
    runMenuAction("add-at-cell", async () => {
      try {
        const result = await createReservationTable({
          number,
          originX,
          originY,
        });
        if (!result.ok) {
          setMenuError(result.error);
          return;
        }
        toast.success(result.message);
        setMenu(null);
        router.refresh();
      } catch {
        setMenuError("Could not create the table. Try again.");
      }
    });
  }

  function submitMenuDelete() {
    if (!menu || menu.kind !== "table" || disabled || menuPending) return;
    const tableId = menu.tableId;
    runMenuAction(`delete:${tableId}`, async () => {
      try {
        const result = await deleteReservationTable({ tableId });
        if (!result.ok) {
          setMenuError(result.error);
          return;
        }
        setSelectedIds((current) => {
          if (!current.has(tableId)) return current;
          const next = new Set(current);
          next.delete(tableId);
          return next;
        });
        toast.success(result.message);
        setMenu(null);
        router.refresh();
      } catch {
        setMenuError("Could not delete the table. Try again.");
      }
    });
  }

  const tableIds = new Set(tables.map((table) => table.id));
  const selection = new Set([...selectedIds].filter((id) => tableIds.has(id)));
  const selected = displayed.filter((table) => selection.has(table.id));
  const menuTable =
    menu?.kind === "table"
      ? (tables.find((table) => table.id === menu.tableId) ?? null)
      : null;

  function clearDrafts() {
    draftRef.current = null;
    setDrafts(null);
  }

  function toggleSelected(tableId: string) {
    setSelectedIds(() => {
      const next = new Set(selection);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
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
    if (mode === "move" && (event.shiftKey || event.metaKey || event.ctrlKey)) {
      toggleSelected(table.id);
      return;
    }

    const groupIds = selection.has(table.id) ? selection : new Set([table.id]);
    if (!selection.has(table.id)) setSelectedIds(groupIds);
    const group = displayed
      .filter((item) => groupIds.has(item.id))
      .map((item) => ({
        tableId: item.id,
        start: {
          originX: item.originX,
          originY: item.originY,
          width: item.width,
          height: item.height,
        },
      }));
    const anchor = group.find((item) => item.tableId === table.id);
    if (!anchor) return;
    const startCell = cellFromPointer(grid, event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    sessionRef.current = {
      anchorId: table.id,
      mode,
      pointerId: event.pointerId,
      moved: false,
      startCell,
      lastCell: startCell,
      anchorStart: anchor.start,
      group,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    const grid = gridRef.current;
    if (!session || !grid || session.pointerId !== event.pointerId) return;
    const cell = cellFromPointer(grid, event.clientX, event.clientY);
    if (
      session.lastCell.col === cell.col &&
      session.lastCell.row === cell.row
    ) {
      return;
    }
    session.lastCell = cell;
    const next = groupGeometry(session, cell.col, cell.row);
    if (
      next.every((draft, index) => {
        const start = session.group[index]?.start;
        return start !== undefined && sameGeometry(draft, start);
      })
    ) {
      return;
    }
    session.moved = true;
    draftRef.current = next;
    setDrafts(next);
  }

  function endDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    tableId: string,
  ) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    sessionRef.current = null;
    if (!session.moved || session.anchorId !== tableId) return;

    const next = draftRef.current;
    if (!next) return;
    const changed = next.filter((draft) => {
      const persisted = tables.find((table) => table.id === draft.tableId);
      return persisted !== undefined && !sameGeometry(persisted, draft);
    });
    if (changed.length === 0) {
      clearDrafts();
      return;
    }
    if (!onMutationStart("layout")) {
      clearDrafts();
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateReservationTableGeometries({
          tables: changed,
        });
        if (!result.ok) {
          clearDrafts();
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch {
        clearDrafts();
        toast.error("Could not save the table layout. Try again.");
      } finally {
        onMutationEnd("layout");
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

  const assignedCount = tables.filter((table) => table.reservedByTeamId).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <Card ref={planRef}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>Floor plan</CardTitle>
              <CardDescription>
                Scroll or pinch to zoom, and drag empty space to look around.
                Shift-click or command-click to select more than one table, then
                drag them to move or resize together. Right-click a table to
                change its number or delete it, or an empty cell to add one.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{tables.length} total</Badge>
              <Badge variant="secondary">{assignedCount} assigned</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">
            {selected.length === 1 && selected[0]
              ? `Table ${selected[0].number}: column ${selected[0].originX + 1}, row ${selected[0].originY + 1}, ${selected[0].width} × ${selected[0].height}.`
              : selected.length > 1
                ? `${selected.length} tables selected. Drag to move them together, or drag a corner to resize them together.`
                : "Right-click an empty cell to add a table."}
          </p>

          <MapViewport
            columns={extent.columns}
            rows={extent.rows}
            fitColumns={columns}
            fitRows={rows}
            onBackgroundClick={() => {
              if (selection.size === 0) return;
              setSelectedIds(new Set());
            }}
          >
            <div
              ref={gridRef}
              onContextMenu={openAddMenu}
              className="grid w-fit"
              style={{
                gap: "var(--map-gap)",
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
                  <span className="size-[12%] rounded-full bg-zinc-400/25" />
                </span>
              ))}
              {displayed.filter(fitsReservationMap).map((table) => {
                const selectedTable = selection.has(table.id);
                return (
                  <div
                    key={table.id}
                    data-floor-table=""
                    onContextMenu={(event) => openTableMenu(event, table)}
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
          </MapViewport>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          The reference cell is the top-left corner of the rectangle.
        </CardFooter>
        {menu && (menu.kind === "add" || menuTable) ? (
          <div
            ref={menuRef}
            role="dialog"
            aria-label={
              menu.kind === "add"
                ? `Add a table at column ${menu.originX + 1}, row ${menu.originY + 1}`
                : `Modify table ${menuTable?.number}`
            }
            className="fixed z-50 w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
            style={{ left: menu.x, top: menu.y }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <form
              noValidate
              className="flex flex-col gap-3"
              onSubmit={submitMenuNumber}
            >
              <p className="text-sm font-medium">
                {menu.kind === "add"
                  ? `Add a table at column ${menu.originX + 1}, row ${menu.originY + 1}`
                  : `Table ${menuTable?.number}`}
              </p>
              {menuTable?.reservedByTeamId ? (
                <p className="text-xs text-muted-foreground">
                  Assigned to {menuTable.reservedByTeamName ?? "a team"}.
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label htmlFor="floor-plan-table-number">Table number</Label>
                <Input
                  id="floor-plan-table-number"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_RESERVATION_TABLE_NUMBER}
                  step={1}
                  value={numberDraft}
                  disabled={disabled || menuPending}
                  autoFocus
                  onChange={(inputEvent) => {
                    setNumberDraft(inputEvent.target.value);
                    setMenuError(null);
                  }}
                />
              </div>
              {menuError ? (
                <p role="alert" className="text-xs text-destructive">
                  {menuError}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={disabled || menuPending}
                >
                  {menuPending ? (
                    <Loader2Icon
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : null}
                  {menu.kind === "add" ? "Add table" : "Change number"}
                </Button>
                {menu.kind === "table" &&
                menuTable &&
                !menuTable.reservedByTeamId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={disabled || menuPending}
                    onClick={submitMenuDelete}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
              {menuTable?.reservedByTeamId ? (
                <Link
                  href={ASSIGNMENTS_HREF}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Unassign the team before deleting this table.
                </Link>
              ) : null}
            </form>
          </div>
        ) : null}
      </Card>
      <div className="flex flex-col gap-5">
        <form noValidate onSubmit={handleSizeSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Map size</CardTitle>
              <CardDescription>
                Set how many columns and rows the floor plan contains.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
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
                  aria-describedby={
                    rowError ? `${rowsInputId}-error` : undefined
                  }
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
              {sizeError ? (
                <p role="alert" className="text-sm text-destructive">
                  {sizeError}
                </p>
              ) : null}
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={disabled} variant="outline">
                {sizePending ? (
                  <Loader2Icon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : null}
                Save map size
              </Button>
            </CardFooter>
          </Card>
        </form>
        {controls}
      </div>
    </div>
  );
}
